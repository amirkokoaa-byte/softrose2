import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, get, child } from "firebase/database";
import { User } from '../types';
import { Lock, User as UserIcon, Loader2, ShieldCheck } from 'lucide-react';

interface Props {
    onLogin: (user: User) => void;
    theme: string;
}

const Login: React.FC<Props> = ({ onLogin, theme }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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

        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        if (!cleanUsername || !cleanPassword) {
            setError('يرجى إدخال البيانات المطلوبة');
            setLoading(false);
            return;
        }

        try {
            if (cleanUsername === 'admin' && cleanPassword === 'admin') {
                const adminUser: User = {
                    key: 'admin_root',
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
                const userKey = Object.keys(users).find(key => 
                    users[key].username?.toString().trim() === cleanUsername && 
                    users[key].password?.toString().trim() === cleanPassword
                );
                
                if (userKey) {
                    const userData = { ...users[userKey], key: userKey };
                    localStorage.setItem('soft_rose_user', JSON.stringify(userData));
                    onLogin(userData);
                } else {
                    setError('بيانات الدخول غير صحيحة');
                }
            } else {
                setError('لا يوجد مستخدمين مسجلين');
            }
        } catch (err) {
            setError('خطأ في الاتصال بالخادم');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#00182b]">
            {/* Background Image with Overlay */}
            <div 
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105"
                style={{ 
                    backgroundImage: `url('https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2548&auto=format&fit=crop')`,
                    filter: 'brightness(0.4) blur(3px)'
                }}
            />

            {/* Glassmorphism Card */}
            <div className="w-full max-w-md z-10 relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                
                <div className="relative bg-black/40 backdrop-blur-2xl border border-white/20 p-8 md:p-10 rounded-3xl shadow-2xl text-white">
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500/80 to-cyan-400/80 rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-white/30 transform -rotate-6 group-hover:rotate-0 transition-transform duration-500">
                            <ShieldCheck size={42} className="text-white drop-shadow-lg" />
                        </div>
                        <h2 className="text-3xl font-black text-center tracking-tight mb-2">سوفت روز</h2>
                        <div className="h-1 w-12 bg-blue-500 rounded-full mb-2"></div>
                        <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-60">Modern Trade System</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest opacity-70 mr-1">اسم المستخدم</label>
                            <div className="relative group/input">
                                <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within/input:text-blue-400 transition-colors" size={18} />
                                <input 
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    className="w-full pr-12 pl-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:bg-white/10 outline-none text-white transition-all placeholder:text-white/20 text-sm font-medium"
                                    placeholder="Username"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest opacity-70 mr-1">كلمة المرور</label>
                            <div className="relative group/input">
                                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within/input:text-blue-400 transition-colors" size={18} />
                                <input 
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full pr-12 pl-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:bg-white/10 outline-none text-white transition-all placeholder:text-white/20 text-sm font-medium"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                        
                        {error && (
                            <div className="bg-red-500/20 border border-red-500/40 text-red-200 px-4 py-3 rounded-xl text-[11px] text-center font-bold animate-in fade-in slide-in-from-top-1">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full relative group/btn overflow-hidden bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all duration-300 transform active:scale-[0.98] shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center justify-center gap-3 mt-4"
                        >
                            <div className="absolute inset-0 w-1/2 h-full bg-white/20 -skew-x-[30deg] -translate-x-full group-hover/btn:animate-shine"></div>
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span className="text-sm">جاري المصادقة...</span>
                                </>
                            ) : (
                                <span className="text-sm tracking-wide">تسجيل الدخول</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-6 border-t border-white/10 text-center">
                        <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">
                            Soft Rose Trading © 2024
                        </p>
                        <p className="text-[11px] font-bold text-blue-400 mt-2 opacity-60">
                            مع تحيات المطور Amir Lamay
                        </p>
                    </div>
                </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-[-10%] left-[-5%] w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] z-0"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] z-0"></div>
        </div>
    );
};

export default Login;