const fs = require('fs');
let content = fs.readFileSync('components/DailySales.tsx', 'utf8');

content = content.replace(
  /<div key=\{item\.id\} className="grid grid-cols-12 gap-2 items-center bg-black\/20 p-2 rounded-2xl border border-transparent hover:border-white\/10 transition">/,
  `<div 
        key={item.id} 
        draggable={user.role === 'admin'}
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, item.id, cat.key)}
        className={\`grid grid-cols-12 gap-2 items-center bg-black/20 p-2 rounded-2xl border transition \${draggedItemId === item.id ? 'opacity-50 border-dashed border-white/50' : 'border-transparent hover:border-white/10'} \${user.role === 'admin' ? 'cursor-move' : ''}\`}
    >`
);

fs.writeFileSync('components/DailySales.tsx', content);
