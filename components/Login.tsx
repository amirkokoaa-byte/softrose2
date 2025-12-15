import React, { useState } from 'react';
import { db } from '../firebase';
import { ref, get, child } from "firebase/database";
import { User } from '../types';
import { Lock, User as UserIcon } from 'lucide-react';

interface Props {
    onLogin: (user: User) => void;
    theme: string;
}

const Login: React.FC<Props> = ({ onLogin, theme }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Hardcoded fallback for initial access if DB is empty or connection fails
            if (username === 'admin' && password === 'admin') {
                onLogin({
                    username: 'admin',
                    name: 'Admin',
                    role: 'admin',
                    canViewAllSales: true
                });
                return;
            }

            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, `users`));
            
            if (snapshot.exists()) {
                const users = snapshot.val();
                const userKey = Object.keys(users).find(key => users[key].username === username && users[key].password === password);
                
                if (userKey) {
                    onLogin(users[userKey]);
                } else {
                    setError('اسم المستخدم أو كلمة المرور غير صحيحة');
                }
            } else {
                setError('لا يوجد مستخدمين مسجلين. جرب admin/admin');
            }
        } catch (err) {
            console.error(err);
            setError('حدث خطأ في الاتصال');
        } finally {
            setLoading(false);
        }
    };

    const containerClass = theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white/80 backdrop-blur-md text-gray-800';

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-400 to-purple-500'}`}>
            <div className={`w-full max-w-md p-8 rounded-2xl shadow-2xl ${containerClass}`}>
                <h2 className="text-3xl font-bold text-center mb-8">تسجيل الدخول</h2>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block mb-2 font-medium">اسم المستخدم</label>
                        <div className="relative">
                            <UserIcon className="absolute right-3 top-3 text-gray-400" size={20} />
                            <input 
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-black"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block mb-2 font-medium">كلمة المرور</label>
                        <div className="relative">
                            <Lock className="absolute right-3 top-3 text-gray-400" size={20} />
                            <input 
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-black"
                                required
                            />
                        </div>
                    </div>
                    
                    {error && <div className="text-red-500 text-sm text-center">{error}</div>}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-105"
                    >
                        {loading ? 'جاري التحميل...' : 'دخول'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;