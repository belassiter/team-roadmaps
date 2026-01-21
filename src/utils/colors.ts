export const generateColorPalette = (): string[] => {
    const colors: string[] = [];
    const hueValues = [0, 30, 45, 120, 180, 210, 270, 320];
    const lightnessValues = [30, 45, 60, 75, 90];
    
    for (const l of lightnessValues) {
        for (const h of hueValues) {
            colors.push(`hsl(${h}, 85%, ${l}%)`);
        }
    }
    return colors;
};
