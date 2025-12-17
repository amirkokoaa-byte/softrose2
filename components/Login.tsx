import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, get, child } from "firebase/database";
import { User } from '../types';
import { Lock, User as UserIcon, Loader2 } from 'lucide-react';

interface Props {
    onLogin: (user: User) => void;
    theme: string;
}

const Login: React.FC<Props> = ({ onLogin, theme }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Check if user was previously logged in
    useEffect(() => {
        const savedUser = localStorage.getItem('soft_rose_user');
        if (savedUser) {
            try {
                onLogin(JSON.parse(savedUser));
            } catch (e) {
                localStorage.removeItem('soft_rose_user');
            }
        }
    }, [onLogin]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Trim inputs to remove accidental spaces from mobile keyboards
        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        if (!cleanUsername || !cleanPassword) {
            setError('يرجى إدخال اسم المستخدم وكلمة المرور');
            setLoading(false);
            return;
        }

        try {
            // Hardcoded fallback for emergency/initial access
            if (cleanUsername === 'admin' && cleanPassword === 'admin') {
                const adminUser: User = {
                    username: 'admin',
                    name: 'Admin',
                    role: 'admin',
                    canViewAllSales: true
                };
                localStorage.setItem('soft_rose_user', JSON.stringify(adminUser));
                onLogin(adminUser);
                return;
            }

            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, `users`));
            
            if (snapshot.exists()) {
                const users = snapshot.val();
                // Safe lookup with trimming and case-insensitive check if needed
                const userKey = Object.keys(users).find(key => 
                    users[key].username?.toString().trim() === cleanUsername && 
                    users[key].password?.toString().trim() === cleanPassword
                );
                
                if (userKey) {
                    const userData = users[userKey];
                    localStorage.setItem('soft_rose_user', JSON.stringify(userData));
                    onLogin(userData);
                } else {
                    setError('اسم المستخدم أو كلمة المرور غير صحيحة. تأكد من عدم وجود مسافات زائدة.');
                }
            } else {
                setError('لا يوجد مستخدمين مسجلين في النظام.');
            }
        } catch (err) {
            console.error(err);
            setError('خطأ في الاتصال بقاعدة البيانات. تأكد من وجود إنترنت.');
        } finally {
            setLoading(false);
        }
    };

    const containerClass = theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white/80 backdrop-blur-md text-gray-800';

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-400 to-purple-500'}`}>
            <div className={`w-full max-w-md p-8 rounded-2xl shadow-2xl ${containerClass}`}>
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                        <UserIcon size={40} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-center">سوفت روز</h2>
                    <p className="text-sm opacity-60">نظام التجارة الحديثة</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block mb-2 font-medium text-sm">اسم المستخدم</label>
                        <div className="relative">
                            <UserIcon className="absolute right-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-black bg-gray-50/50"
                                placeholder="أدخل اسمك المسجل"
                                required
                                autoComplete="username"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block mb-2 font-medium text-sm">كلمة المرور</label>
                        <div className="relative">
                            <Lock className="absolute right-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-black bg-gray-50/50"
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />
                        </div>
                    </div>
                    
                    {error && (
                        <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs text-center animate-pulse">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition transform active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                جاري التحقق...
                            </>
                        ) : 'دخول النظام'}
                    </button>
                </form>
                <div className="mt-8 text-center text-xs opacity-50">
                    في حال نسيان البيانات يرجى التواصل مع المدير
                </div>
            </div>
        </div>
    );
};

export default Login;