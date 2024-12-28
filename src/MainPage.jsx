import React, { useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import _ from 'lodash';
import {Link} from "react-router-dom";

const exportDistributionData = (chartData) => {
    // Get sites and price ranges
    const sites = Object.keys(chartData[0]).filter(key => key !== 'range');
    const priceRanges = chartData.map(point => point.range);

    // Create CSV headers with price ranges
    const headers = ['Site', ...priceRanges];

    // Convert data to rows where each row represents a site
    const rows = sites.map(site => {
        return [
            site,
            ...chartData.map(point => point[site])
        ];
    });

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'price-distribution.csv';
    link.click();
    URL.revokeObjectURL(link.href);
};

const PRICE_RANGES = [
    { min: 0, max: 1, label: '$0-1' },
    { min: 1, max: 5, label: '$1-5' },
    { min: 5, max: 10, label: '$5-10' },
    { min: 10, max: 25, label: '$10-25' },
    { min: 25, max: 50, label: '$25-50' },
    { min: 50, max: 100, label: '$50-100' },
    { min: 100, max: Infinity, label: '$100+' }
];

// Available site processors
const SITE_PROCESSORS = {
    'ggdrop.json': {
        name: 'GGDrop',
        processData: (data) => {
            return data.data.cases
                .flatMap(category => category.caseItems)
                .map(item => ({
                    name: item.title_en,
                    price: item.price / 104.5 // Convert to USD
                }));
        }
    },
    'key-drop.json': {
        name: 'KeyDrop',
        processData: (data) => {
            return data.data.map(item => ({
                name: item.name,
                price: item.price
            }));
        }
    },
    'skin-club.json': {
        name: 'Skin Club',
        processData: (data) => {
            return data.data
                .flatMap(section => section.cases)
                .filter(item => item.price && item.title)
                .map(item => ({
                    name: item.title,
                    price: item.price / 100 // Convert to USD
                }));
        }
    },
    'hellcase.json': {
        name: 'Hellcase',
        processData: (data) => {
            return data.main_page
                .flatMap(category => category.cases_to_show)
                .filter(item => item.price && item.locale_name)
                .map(item => ({
                    name: item.locale_name,
                    price: item.price
                }));
        }
    }
};

// Process case data for price distribution
const processCaseData = (cases) => {
    return PRICE_RANGES.map(range => ({
        count: cases.filter(c => c.price >= range.min && c.price < range.max).length
    }));
};

const MainPage = () => {
    const [chartData, setChartData] = useState([]);
    const [stats, setStats] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [processedFiles, setProcessedFiles] = useState(new Set());

    const processSiteData = (siteName, cases) => {
        const prices = cases.map(c => c.price);
        return {
            site: siteName,
            caseCount: cases.length,
            avgPrice: _.mean(prices).toFixed(2),
            medianPrice: _.sortBy(prices)[Math.floor(prices.length / 2)].toFixed(2),
            distribution: processCaseData(cases)
        };
    };

    const updateChartData = (sitesData) => {
        const newChartData = PRICE_RANGES.map((range, index) => {
            const dataPoint = {
                range: range.label
            };
            sitesData.forEach(site => {
                dataPoint[site.site] = site.distribution[index].count;
            });
            return dataPoint;
        });
        setChartData(newChartData);
    };

    const handleFiles = useCallback(async (files) => {
        const fileArray = Array.from(files);
        const newData = [];

        for (const file of fileArray) {
            // Skip already processed files
            if (processedFiles.has(file.name) || !SITE_PROCESSORS[file.name]) {
                continue;
            }

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const processor = SITE_PROCESSORS[file.name];
                const cases = processor.processData(data);
                const siteData = processSiteData(processor.name, cases);
                newData.push(siteData);
                setProcessedFiles(prev => new Set([...prev, file.name]));
            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
            }
        }

        if (newData.length > 0) {
            setStats(prevStats => {
                const combinedStats = [...prevStats];
                newData.forEach(data => {
                    const existingIndex = combinedStats.findIndex(s => s.site === data.site);
                    if (existingIndex >= 0) {
                        combinedStats[existingIndex] = data;
                    } else {
                        combinedStats.push(data);
                    }
                });
                updateChartData(combinedStats);
                return combinedStats;
            });
        }
    }, [processedFiles]);

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
        setChartData([]);
        setStats([]);
        setProcessedFiles(new Set());
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-center">Lootbox Sites Analysis</h1>
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

                <Link
                    to="/rtp-generator"
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    RTP Generator
                </Link>
            </nav>

            {/* Drag and Drop Area */}
            <div
                className={`mb-8 p-8 border-2 border-dashed rounded-lg text-center 
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${stats.length === 0 ? 'h-48 flex items-center justify-center' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                {stats.length === 0 ? (
                    <div>
                        <p className="mb-4">Drag and drop JSON files here or click to select</p>
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

            {stats.length > 0 && (
                <>
                    {/* Chart Section */}
                    <div className="mb-12 bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Price Distribution</h2>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3"/>
                                    <XAxis dataKey="range"/>
                                    <YAxis/>
                                    <Tooltip/>
                                    <Legend/>
                                    {stats.map((site, index) => (
                                        <Bar
                                            key={site.site}
                                            dataKey={site.site}
                                            fill={`hsl(${index * (360 / stats.length)}, 70%, 50%)`}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => exportDistributionData(chartData)}
                            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center"
                        >
                            <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                            Export All Data
                        </button>
                    </div>

                    {/* Stats Table */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Site Statistics</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                <tr>
                                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Site
                                    </th>
                                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Cases
                                    </th>
                                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Average Price
                                    </th>
                                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Median Price
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {stats.map((site) => (
                                    <tr key={site.site}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium">{site.site}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{site.caseCount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">${site.avgPrice}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">${site.medianPrice}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default MainPage;