// src/utils/gridConverters.js
import { parseLocalYMD } from './dates';

export const getGridIndexFromDate = (targetDateStr, startDateStr, mode) => {
    const target = parseLocalYMD(targetDateStr);
    const start = parseLocalYMD(startDateStr);
    
    // Normalize both to midnight to be safe (parseLocalYMD does this by using Y, M-1, D)
    
    // Helper to get Monday of the week
    const getMonday = (d) => {
        const dCopy = new Date(d);
        const day = dCopy.getDay();
        const diff = dCopy.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        dCopy.setDate(diff);
        return dCopy;
    };

    if (mode === 'week') {
        const startMonday = getMonday(start);
        const targetMonday = getMonday(target);
        
        const diffTime = targetMonday - startMonday;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return Math.floor(diffDays / 7);
    } else {
        // Day mode (and Number mode treating start as day 0)
        const diffTime = target - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays;
    }
};

export const getDateFromGridIndex = (index, startDateStr, mode) => {
    const start = parseLocalYMD(startDateStr);
    const result = new Date(start);

    if (mode === 'week') {
         // Snap start to Monday
        const day = result.getDay();
        const diff = result.getDate() - day + (day === 0 ? -6 : 1);
        result.setDate(diff);
        
        result.setDate(result.getDate() + (index * 7));
    } else {
        result.setDate(result.getDate() + index);
    }
    
    return result;
};
