const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

content = content.replace(
  /const \[products, setProducts\] = useState<\{id: string, name: string, category: string\}\[\]>\(\[\]\);/,
  `const [products, setProducts] = useState<{id: string, name: string, category: string, order?: number}[]>([]);`
);

content = content.replace(
  /category: item\?\.category \|\| 'Uncategorized'\n          \};\n        \}\);\n        setProducts\(prods\);/,
  `category: item?.category || 'Uncategorized',
            order: item?.order || 0
          };
        }).sort((a, b) => (a.order || 0) - (b.order || 0));
        setProducts(prods);`
);

fs.writeFileSync('App.tsx', content);
