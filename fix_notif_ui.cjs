const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

// In Dropdown
content = content.replace(
    /<div className="max-h-80 overflow-y-auto custom-scrollbar">([\s\S]*?)<\/div>/,
    `<div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center opacity-30 italic text-sm text-white">لا توجد إشعارات</div>
                            ) : (
                                notifications.map(n => (
                                    <div 
                                      key={n.id} 
                                      onClick={() => { 
                                          markAsRead(n.id!); 
                                          setShowNotifDropdown(false); 
                                          if (n.actionType === 'prices' && user.role === 'admin') {
                                              setCurrentView('competitorReports'); 
                                          } else {
                                              setSelectedNotif(n);
                                          }
                                      }}
                                      className={\`p-4 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer \${!n.isRead ? 'bg-blue-600/10' : ''}\`}
                                    >
                                        <div className="font-bold text-sm text-blue-400 mb-1">{n.sender || 'System'}</div>
                                        <div className="text-xs text-white opacity-80 mb-2">{n.message}</div>
                                        <div className="flex justify-between items-center text-[9px] opacity-40">
                                            <span>{n.dateString || new Date(n.timestamp).toLocaleDateString('ar-EG')}</span>
                                            <span>{n.timeString || new Date(n.timestamp).toLocaleTimeString('ar-EG')}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>`
);

// In Modal
content = content.replace(
    /<div className="text-xs font-black opacity-40 uppercase mb-2">المرسل: \{selectedNotif\.sender\}<\/div>\n              <div className="bg-white\/5 p-4 rounded-2xl border border-white\/5 text-sm leading-relaxed text-gray-200">\n                \{selectedNotif\.message\}\n              <\/div>/,
    `<div className="text-xs font-black opacity-40 uppercase mb-2">المرسل: {selectedNotif.sender || 'System'}</div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-sm leading-relaxed text-gray-200 mb-4">
                {selectedNotif.message}
              </div>
              {selectedNotif.dateString && (
                  <div className="flex justify-between items-center text-[10px] opacity-50 uppercase font-black bg-black/40 p-3 rounded-xl">
                      <span>التاريخ: {selectedNotif.dateString}</span>
                      <span>الساعة: {selectedNotif.timeString}</span>
                  </div>
              )}`
);

fs.writeFileSync('App.tsx', content);
