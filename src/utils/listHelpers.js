// src/utils/listHelpers.js

export const filterItems = (items, searchTerm) => {
    if (!searchTerm) return items;
    const lowerTerm = searchTerm.toLowerCase();
    return items.filter(item => 
        item.name.toLowerCase().includes(lowerTerm)
    );
};

export const sortItems = (items, key, order) => {
    // Create a shallow copy to avoid mutating the original array
    const sorted = [...items];
    
    sorted.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];
        
        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });
    
    return sorted;
};
