import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MainPage from "./MainPage.jsx";
import CaseAnalysis from "./CaseAnalysis.jsx";
import RtpGenerator from "./RtpGenerator.jsx";


const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<MainPage />} />
                <Route path="/case-analysis" element={<CaseAnalysis />} />
                <Route path="/rtp-generator" element={<RtpGenerator />} />
            </Routes>
        </Router>
    );
};

export default App;