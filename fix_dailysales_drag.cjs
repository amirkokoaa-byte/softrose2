const fs = require('fs');
let content = fs.readFileSync('components/DailySales.tsx', 'utf8');

const dragState = `    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);`;

content = content.replace(
  /const \[tempName, setTempName\] = useState\(''\);/,
  `const [tempName, setTempName] = useState('');\n${dragState}`
);

const dragHandlers = `    const handleDragStart = (e: React.DragEvent, id: string) => {
        if (user.role !== 'admin') return;
        e.dataTransfer.setData('text/plain', id);
        setDraggedItemId(id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (user.role !== 'admin') return;
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, targetId: string, targetCategory: string) => {
        if (user.role !== 'admin') return;
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === targetId) return;

        const draggedIndex = products.findIndex(p => p.id === draggedId);
        const targetIndex = products.findIndex(p => p.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const newProducts = [...products];
        const [removed] = newProducts.splice(draggedIndex, 1);
        removed.category = targetCategory;
        newProducts.splice(targetIndex, 0, removed);

        const updates: any = {};
        newProducts.forEach((p, idx) => {
            updates[\`\${p.id}/order\`] = idx;
            if (p.id === draggedId) {
                updates[\`\${p.id}/category\`] = targetCategory;
            }
        });

        await update(ref(db, 'products'), updates);
        setDraggedItemId(null);
    };`;

content = content.replace(
  /const updateItem = \(id: string, field: string, value: any\) => \{/,
  `${dragHandlers}\n\n    const updateItem = (id: string, field: string, value: any) => {`
);

fs.writeFileSync('components/DailySales.tsx', content);
