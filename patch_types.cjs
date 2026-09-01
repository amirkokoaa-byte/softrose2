const fs = require('fs');
let content = fs.readFileSync('types.ts', 'utf8');

const commentStr = `export interface SaleComment {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    isLiked?: boolean;
}

`;

if (!content.includes('SaleComment')) {
    content = commentStr + content;
}

content = content.replace(/total: number;/g, `total: number;
    likes?: string[];
    dislikes?: string[];
    comments?: SaleComment[];`);

fs.writeFileSync('types.ts', content);
