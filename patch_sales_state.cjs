const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

const newStates = `
    const [commentText, setCommentText] = useState<{[key: string]: string}>({});
    const [showCommentInput, setShowCommentInput] = useState<{[key: string]: boolean}>({});

    const handleReaction = async (saleId: string, type: 'like' | 'dislike') => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;
        
        let likes = sale.likes || [];
        let dislikes = sale.dislikes || [];
        
        const userKey = user.username || user.name;
        
        if (type === 'like') {
            if (likes.includes(userKey)) {
                likes = likes.filter(u => u !== userKey);
            } else {
                likes.push(userKey);
                dislikes = dislikes.filter(u => u !== userKey);
            }
        } else {
            if (dislikes.includes(userKey)) {
                dislikes = dislikes.filter(u => u !== userKey);
            } else {
                dislikes.push(userKey);
                likes = likes.filter(u => u !== userKey);
            }
        }
        
        await update(ref(db, \`sales/\${saleId}\`), { likes, dislikes });
    };

    const handleAddComment = async (saleId: string) => {
        const text = commentText[saleId]?.trim();
        if (!text) return;
        
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;
        
        const newComment = {
            id: Date.now().toString(),
            text,
            senderId: user.username || user.name,
            senderName: user.name,
            timestamp: Date.now(),
            isLiked: false
        };
        
        const comments = [...(sale.comments || []), newComment];
        await update(ref(db, \`sales/\${saleId}\`), { comments });
        
        setCommentText(prev => ({ ...prev, [saleId]: '' }));
        setShowCommentInput(prev => ({ ...prev, [saleId]: false }));

        // Send notification to employee
        const employeeUser = usersList.find(u => u.name === sale.employeeName);
        const notifTarget = sale.username || (employeeUser ? employeeUser.username : null);
        if (notifTarget && notifTarget !== user.username) {
            push(ref(db, \`notifications/\${notifTarget}\`), {
                message: \`أضاف \${user.name} تعليقاً على مبيعاتك في \${sale.market}\`,
                sender: user.name,
                timestamp: Date.now(),
                isRead: false
            });
        }
    };

    const handleLikeComment = async (saleId: string, commentId: string) => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;
        
        const comments = (sale.comments || []).map(c => 
            c.id === commentId ? { ...c, isLiked: !c.isLiked } : c
        );
        
        await update(ref(db, \`sales/\${saleId}\`), { comments });
        
        const comment = sale.comments?.find(c => c.id === commentId);
        if (comment) {
            push(ref(db, \`notifications/admin_alerts\`), {
                message: \`أعجب \${user.name} بتعليق \${comment.senderName}\`,
                sender: user.name,
                timestamp: Date.now(),
                isRead: false
            });
        }
    };
`;

content = content.replace('const [sales, setSales] = useState<SaleRecord[]>([]);', 'const [sales, setSales] = useState<SaleRecord[]>([]);\n' + newStates);

fs.writeFileSync('components/SalesLog.tsx', content);
