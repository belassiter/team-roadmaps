// src/utils/colors.js
export const generateColorPalette = () => {
    const colors = [];
    const hueValues = [0, 30, 45, 120, 180, 210, 270, 320];
    const lightnessValues = [30, 45, 60, 75, 90];
    
    for (let l of lightnessValues) {
        for (let h of hueValues) {
            colors.push(`hsl(${h}, 85%, ${l}%)`);
        }
    }
    return colors;
};
