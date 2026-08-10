const fs = require('fs');
let content = fs.readFileSync('components/DailySales.tsx', 'utf8');

const emptyDropHandler = `
    const handleCategoryDrop = async (e: React.DragEvent, targetCategory: string) => {
        if (user.role !== 'admin') return;
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId) return;

        // Only handle if dropping directly on the category container (not on an item)
        // Check if the drop target is the container itself
        if (e.target === e.currentTarget) {
            const draggedIndex = products.findIndex(p => p.id === draggedId);
            if (draggedIndex === -1) return;

            const newProducts = [...products];
            const [removed] = newProducts.splice(draggedIndex, 1);
            removed.category = targetCategory;
            
            // Append to the end of this category
            // We can just push it to the end of newProducts, or find the last item of this category
            const lastCatIndex = newProducts.findLastIndex(p => p.category === targetCategory);
            if (lastCatIndex !== -1) {
                newProducts.splice(lastCatIndex + 1, 0, removed);
            } else {
                newProducts.push(removed);
            }

            const updates: any = {};
            newProducts.forEach((p, idx) => {
                updates[\`\${p.id}/order\`] = idx;
                if (p.id === draggedId) {
                    updates[\`\${p.id}/category\`] = targetCategory;
                }
            });

            await update(ref(db, 'products'), updates);
            setDraggedItemId(null);
        }
    };
`;

content = content.replace(
  /const handleDrop = async/,
  `${emptyDropHandler}\n\n    const handleDrop = async`
);

content = content.replace(
  /<div className="space-y-2">/,
  `<div className="space-y-2 min-h-[50px] pb-4" onDragOver={handleDragOver} onDrop={(e) => handleCategoryDrop(e, cat.key)}>`
);

fs.writeFileSync('components/DailySales.tsx', content);
