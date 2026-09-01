const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

const targetStr = `                                </div>
                            </div>
                            <div className="flex gap-2">
                            </div>
                        </div>`;

const reactionsUI = `                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleReaction(sale.id, 'like')} className={\`p-1.5 rounded-lg \${(sale.likes || []).includes(user.username || user.name) ? 'bg-blue-600/30 text-blue-400' : 'bg-white/10 text-white/60'} hover:bg-blue-600/50 transition\`}>
                                    <ThumbsUp size={16} /> <span className="text-[10px]">{(sale.likes || []).length}</span>
                                </button>
                                <button onClick={() => handleReaction(sale.id, 'dislike')} className={\`p-1.5 rounded-lg \${(sale.dislikes || []).includes(user.username || user.name) ? 'bg-red-600/30 text-red-400' : 'bg-white/10 text-white/60'} hover:bg-red-600/50 transition\`}>
                                    <ThumbsDown size={16} /> <span className="text-[10px]">{(sale.dislikes || []).length}</span>
                                </button>
                                <button onClick={() => setShowCommentInput(prev => ({ ...prev, [sale.id]: !prev[sale.id] }))} className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition flex items-center gap-1">
                                    <MessageSquare size={16} /> <span className="text-[10px]">{(sale.comments || []).length}</span>
                                </button>
                            </div>
                        </div>`;

if(content.includes(targetStr)) {
    content = content.replace(targetStr, reactionsUI);
    fs.writeFileSync('components/SalesLog.tsx', content);
    console.log("Patched reactions correctly");
} else {
    console.log("target reactions string not found");
}
