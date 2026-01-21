// src/utils/listHelpers.ts

export const filterItems = <T extends { name: string }>(items: T[], searchTerm: string): T[] => {
    if (!searchTerm) return items;
    const lowerTerm = searchTerm.toLowerCase();
    return items.filter(item => 
        item.name.toLowerCase().includes(lowerTerm)
    );
};

export const sortItems = <T>(items: T[], key: keyof T, order: 'asc' | 'desc'): T[] => {
    // Create a shallow copy to avoid mutating the original array
    const sorted = [...items];
    
    sorted.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        
        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });
    
    return sorted;
};
