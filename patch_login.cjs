const fs = require('fs');
let code = fs.readFileSync('components/Login.tsx', 'utf8');

code = code.replace(
`    const [password, setPassword] = useState('');
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
    }, [onLogin]);`,
`    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('soft_rose_user');
        if (savedUser) {
            try {
                onLogin(JSON.parse(savedUser));
            } catch (e) {
                localStorage.removeItem('soft_rose_user');
            }
        }
        
        const remembered = localStorage.getItem('soft_rose_remembered');
        if (remembered) {
            try {
                const parsed = JSON.parse(remembered);
                if (parsed.username && parsed.password) {
                    setUsername(parsed.username);
                    setPassword(parsed.password);
                    setRememberMe(true);
                }
            } catch (e) {
                localStorage.removeItem('soft_rose_remembered');
            }
        }
    }, [onLogin]);`
);

code = code.replace(
`                const adminUser: User = {
                    key: 'admin_root',
                    username: 'admin',
                    name: 'Admin',
                    role: 'admin',
                    canViewAllSales: true
                };
                localStorage.setItem('soft_rose_user', JSON.stringify(adminUser));
                onLogin(adminUser);
                return;`,
`                const adminUser: User = {
                    key: 'admin_root',
                    username: 'admin',
                    name: 'Admin',
                    role: 'admin',
                    canViewAllSales: true
                };
                localStorage.setItem('soft_rose_user', JSON.stringify(adminUser));
                if (rememberMe) {
                    localStorage.setItem('soft_rose_remembered', JSON.stringify({username: cleanUsername, password: cleanPassword}));
                } else {
                    localStorage.removeItem('soft_rose_remembered');
                }
                onLogin(adminUser);
                return;`
);

code = code.replace(
`                if (userKey) {
                    const userData = { ...users[userKey], key: userKey };
                    localStorage.setItem('soft_rose_user', JSON.stringify(userData));
                    onLogin(userData);
                } else {`,
`                if (userKey) {
                    const userData = { ...users[userKey], key: userKey };
                    localStorage.setItem('soft_rose_user', JSON.stringify(userData));
                    if (rememberMe) {
                        localStorage.setItem('soft_rose_remembered', JSON.stringify({username: cleanUsername, password: cleanPassword}));
                    } else {
                        localStorage.removeItem('soft_rose_remembered');
                    }
                    onLogin(userData);
                } else {`
);

code = code.replace(
`                            </div>
                        </div>
                        
                        {error && (`,
`                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                            <input 
                                type="checkbox" 
                                id="rememberMe" 
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded bg-white/5 border-white/10 accent-blue-500"
                            />
                            <label htmlFor="rememberMe" className="text-xs font-bold text-white/70 cursor-pointer">
                                تذكر بيانات الدخول
                            </label>
                        </div>
                        
                        {error && (`
);

fs.writeFileSync('components/Login.tsx', code);
