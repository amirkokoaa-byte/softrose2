import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue } from "firebase/database";
import { User, CompetitorPrice } from '../types';
import { exportToCSV } from '../utils';
import { COMPANIES } from '../constants';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const CompetitorReports: React.FC<Props> = ({ user, markets, theme }) => {
    const [data, setData] = useState<CompetitorPrice[]>([]);
    const [selectedMarket, setSelectedMarket] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [companies, setCompanies] = useState<string[]>(COMPANIES);

    useEffect(() => {
        onValue(ref(db, 'settings/companies'), s => {
            if(s.exists()) setCompanies(Object.values(s.val()));
        });
        onValue(ref(db, 'competitor_prices'), s => {
            if(s.exists()) setData(Object.values(s.val()));
        });
    }, []);

    const filtered = data.filter(d => 
        (!selectedMarket || d.market === selectedMarket) &&
        (!selectedCompany || d.company === selectedCompany)
    );

    const handleExport = () => {
        const csv = filtered.flatMap(d => (d.items || []).map(i => ({
            "الماركت": d.market,
            "الشركة": d.company,
            "التاريخ": d.date,
            "القسم": i.category,
            "المنتج": i.name,
            "السعر": i.price
        })));
        exportToCSV(csv, 'Competitor_Report');
    };

    const inputClass = "border p-2 rounded text-black w-full";

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">تقارير المنافسين</h2>
            <div className="flex gap-4">
                <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                    <option value="">كل الماركتات</option>
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                    <option value="">كل الشركات</option>
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={handleExport} className="bg-green-600 text-white px-4 rounded whitespace-nowrap">تصدير اكسيل</button>
            </div>

            <div className="space-y-4">
                {filtered.map((record, i) => (
                    <div key={i} className={`p-4 rounded border ${theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow'}`}>
                        <div className="font-bold text-lg mb-2 flex justify-between">
                            <span>{record.company} @ {record.market}</span>
                            <span className="text-sm opacity-70">{record.date}</span>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-500/10">
                                    <th className="p-2 text-right">المنتج</th>
                                    <th className="p-2 text-right">السعر</th>
                                    <th className="p-2 text-right">القسم</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(record.items || []).map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-500/10">
                                        <td className="p-2">{item.name}</td>
                                        <td className="p-2 font-bold">{item.price}</td>
                                        <td className="p-2 opacity-70">{item.category}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CompetitorReports;