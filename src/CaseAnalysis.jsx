// src/routes/CaseAnalysis.jsx
import React, { useState, useCallback } from 'react';
import _ from 'lodash';
import {Link} from "react-router-dom";

const calculateRTP = (items, casePrice) => {
    let totalProbability = 0;
    let expectedValue = 0;

    items.forEach(item => {
        item.steam_items.forEach(steamItem => {
            totalProbability += steamItem.probability;
            expectedValue += steamItem.probability * (steamItem.steam_price / 100); // Convert to USD
        });
    });

    // RTP = (Expected Value / Case Price) * 100%
    return (expectedValue / (casePrice || 1)) * 100;
};

const determineRiskType = (items) => {
    const probabilities = items.flatMap(item =>
        item.steam_items.map(si => ({
            price: si.steam_price,
            probability: si.probability
        }))
    );

    const highValueProb = probabilities
        .filter(p => p.price > 5000)
        .reduce((sum, p) => sum + p.probability, 0);

    const lowValueProb = probabilities
        .filter(p => p.price < 500)
        .reduce((sum, p) => sum + p.probability, 0);

    if (highValueProb < 0.001 && lowValueProb < 0.5) return "low risk";
    if (highValueProb > 0.001 && lowValueProb > 0.7) return "high risk";
    return "medium risk";
};

const SITE_PROCESSORS = {
    'ggdrop': {
        name: 'GGDrop',
        processData: (data) => ({
            name: data.data.title_en,
            price: data.data.price / 104.5,
            items: data.data.items,
            rtp: calculateRTP(data.data.items, data.data.price / 104.5),
            minPrice: Math.min(...data.data.items.flatMap(item =>
                item.steam_items.map(si => si.steam_price)
            )) / 100,
            maxPrice: Math.max(...data.data.items.flatMap(item =>
                item.steam_items.map(si => si.steam_price)
            )) / 100,
            riskType: determineRiskType(data.data.items)
        })
    },
    'hellcase': {
        name: 'HellCase',
        processData: (data) => {
            const items = data.itemlist.map(item => ({
                steam_items: item.items.map(subItem => ({
                    steam_price: subItem.steam_price_en, // Convert to cents
                    probability: subItem.odds // Use odds for probability
                }))
            }));

            return {
                name: data.casename,
                price: data.case_price,
                items: items,
                rtp: calculateRTP(items, data.case_price),
                minPrice: Math.min(...items.flatMap(item => item.steam_items.map(si => si.steam_price))),
                maxPrice: Math.max(...items.flatMap(item => item.steam_items.map(si => si.steam_price))),
                riskType: determineRiskType(items)
            };
        }
    }
};

const CaseAnalysis = () => {
    const [dragActive, setDragActive] = useState(false);
    const [processedFiles, setProcessedFiles] = useState(new Set());
    const [caseAnalysis, setCaseAnalysis] = useState({});
    const [activeSite, setActiveSite] = useState(null);

    const handleFiles = useCallback(async (files) => {
        const fileArray = Array.from(files);
        const newCaseAnalysis = { ...caseAnalysis };

        for (const file of fileArray) {
            if (processedFiles.has(file.name)) continue;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                const siteName = file.name.split('-')[0];
                const processor = SITE_PROCESSORS[siteName];

                if (processor) {
                    const processedCase = processor.processData(data);

                    if (!newCaseAnalysis[siteName]) {
                        newCaseAnalysis[siteName] = {};
                    }
                    newCaseAnalysis[siteName][file.name] = processedCase;

                    setProcessedFiles(prev => new Set([...prev, file.name]));
                }
            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
            }
        }

        if (Object.keys(newCaseAnalysis).length > 0) {
            setCaseAnalysis(newCaseAnalysis);
            if (!activeSite) {
                setActiveSite(Object.keys(newCaseAnalysis)[0]);
            }
        }
    }, [processedFiles, caseAnalysis, activeSite]);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const resetAnalysis = () => {
        setCaseAnalysis({});
        setProcessedFiles(new Set());
        setActiveSite(null);
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-center">Case Analysis</h1>

            <nav className="my-4">
                <Link
                    to="/"
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Home
                </Link>

                <Link
                    to="/case-analysis"
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Case Analysis
                </Link>
            </nav>

            <div
                className={`mb-8 p-8 border-2 border-dashed rounded-lg text-center 
                    ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                    ${Object.keys(caseAnalysis).length === 0 ? 'h-48 flex items-center justify-center' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                {Object.keys(caseAnalysis).length === 0 ? (
                    <div>
                        <p className="mb-4">Drag and drop case files here or click to select</p>
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileInput}
                            accept=".json"
                            id="fileInput"
                        />
                        <label
                            htmlFor="fileInput"
                            className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600"
                        >
                            Select Files
                        </label>
                    </div>
                ) : (
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-600">Drop more files to add to the analysis</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Processed files: {Array.from(processedFiles).join(', ')}
                            </p>
                        </div>
                        <button
                            onClick={resetAnalysis}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                        >
                            Reset Analysis
                        </button>
                    </div>
                )}
            </div>

            {Object.keys(caseAnalysis).length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="mb-4 border-b">
                        <div className="flex">
                            {Object.entries(caseAnalysis).map(([site, cases]) => (
                                <button
                                    key={site}
                                    onClick={() => setActiveSite(site)}
                                    className={`px-4 py-2 mr-2 font-medium rounded-t-lg ${
                                        activeSite === site
                                            ? 'bg-white border border-b-0 text-blue-600'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {SITE_PROCESSORS[site].name} [{Object.keys(cases).length}]
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeSite && (
                        <div className="rounded-lg border">
                            <table className="w-full">
                                <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="p-2 text-left">Case Name</th>
                                    <th className="p-2 text-left">Price ($)</th>
                                    <th className="p-2 text-left">RTP (%)</th>
                                    <th className="p-2 text-left">Min Price ($)</th>
                                    <th className="p-2 text-left">Max Price ($)</th>
                                    <th className="p-2 text-left">Risk Type</th>
                                </tr>
                                </thead>
                                <tbody>
                                {Object.entries(caseAnalysis[activeSite])
                                    .sort(([, a], [, b]) => b.price - a.price)
                                    .map(([filename, caseData]) => (
                                        <tr key={filename} className="border-b">
                                            <td className="p-2">{caseData.name}</td>
                                            <td className="p-2">{caseData.price.toFixed(2)}</td>
                                            <td className="p-2">{caseData.rtp.toFixed(2)}</td>
                                            <td className="p-2">{caseData.minPrice.toFixed(2)}</td>
                                            <td className="p-2">{caseData.maxPrice.toFixed(2)}</td>
                                            <td className="p-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                                        caseData.riskType === 'low risk' ? 'bg-green-100 text-green-800' :
                                                            caseData.riskType === 'medium risk' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-red-100 text-red-800'
                                                    }`}>
                                                        {caseData.riskType}
                                                    </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CaseAnalysis;