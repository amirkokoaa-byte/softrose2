const fs = require('fs');
let content = fs.readFileSync('components/DailySales.tsx', 'utf8');

content = content.replace(
  /products: \{id: string, name: string, category: string\}\[\];/,
  `products: {id: string, name: string, category: string, order?: number}[];`
);

fs.writeFileSync('components/DailySales.tsx', content);
