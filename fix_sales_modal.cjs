const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// Replace the unbalanced part
const badSyntax = `                        </div>
                        </div>
                        <button onClick={() => setShowProductSalesDataModal(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg mt-4">اظهر البيانات</button>
                    </div>
                </div>
            )}`;

const goodSyntax = `                        </div>
                        <button onClick={() => setShowProductSalesDataModal(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg mt-4">اظهر البيانات</button>
                    </div>
                </div>
            )}`;

content = content.replace(badSyntax, goodSyntax);
fs.writeFileSync('components/SalesLog.tsx', content);
