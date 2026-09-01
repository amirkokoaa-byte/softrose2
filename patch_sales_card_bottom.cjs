const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

const commentsUI = `
                        {(showCommentInput[sale.id] || (sale.comments && sale.comments.length > 0)) && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="space-y-3 mb-4">
                                    {(sale.comments || []).map(comment => (
                                        <div key={comment.id} className="bg-white/5 rounded-xl p-3 flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-blue-300">{comment.senderName}</span>
                                                    <span className="text-[9px] opacity-50">{new Date(comment.timestamp).toLocaleString('ar-EG')}</span>
                                                </div>
                                                <p className="text-xs text-white/90 whitespace-pre-wrap">{comment.text}</p>
                                            </div>
                                            <button onClick={() => handleLikeComment(sale.id, comment.id)} className={\`p-1.5 rounded-full \${comment.isLiked ? 'text-red-500 bg-red-500/10' : 'text-white/40 hover:text-white/80 hover:bg-white/10'} transition\`}>
                                                <Heart size={14} fill={comment.isLiked ? 'currentColor' : 'none'} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {showCommentInput[sale.id] && (
                                    <div className="flex gap-2">
                                        <textarea 
                                            value={commentText[sale.id] || ''}
                                            onChange={e => setCommentText(prev => ({ ...prev, [sale.id]: e.target.value.substring(0, 1000) }))}
                                            placeholder="أضف تعليقاً..."
                                            className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 min-h-[40px] max-h-[80px]"
                                            maxLength={1000}
                                        />
                                        <button onClick={() => handleAddComment(sale.id)} disabled={!commentText[sale.id]?.trim()} className="bg-blue-600 text-white p-2.5 rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-blue-700 transition">
                                            <Send size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
`;

// Insert before `                    </div>\n                ))}`
// But wait, there are multiple map loops maybe? Let's check `))}` in SalesLog.tsx.
content = content.replace(/<\/div>\s*\}\)\}\s*<\/div>/g, (match) => {
    return commentsUI + '\n' + match;
});

fs.writeFileSync('components/SalesLog.tsx', content);
