const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

content = content.replace(
    /Trash2, Edit, FileSpreadsheet, Save, X, Calendar, User as UserIcon, TrendingUp, Star, Trophy, Download, Filter, Target, History, Copy, Search, Package, ShoppingBag, Calculator, ChevronDown, ChevronUp, Printer/g,
    'Trash2, Edit, FileSpreadsheet, Save, X, Calendar, User as UserIcon, TrendingUp, Star, Trophy, Download, Filter, Target, History, Copy, Search, Package, ShoppingBag, Calculator, ChevronDown, ChevronUp, Printer, ThumbsUp, ThumbsDown, MessageSquare, Send, Heart'
);

fs.writeFileSync('components/SalesLog.tsx', content);
