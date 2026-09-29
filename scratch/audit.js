const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walk(filepath, callback);
        } else {
            callback(filepath);
        }
    }
}

console.log("=== N+1 Query Candidates (for/map + await prisma) ===");
walk('apps/api/src', (filepath) => {
    if (filepath.endsWith('.ts')) {
        const content = fs.readFileSync(filepath, 'utf8');
        if (content.includes('await this.prisma') && (content.includes('for (') || content.includes('.map(async'))) {
            // Rough heuristic: if they appear close to each other
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('.map(async') || lines[i].includes('for (')) {
                    for (let j = i; j < Math.min(i + 15, lines.length); j++) {
                        if (lines[j].includes('await this.prisma')) {
                            console.log(`[Potential N+1] ${filepath}:${i+1}`);
                            console.log(`   ${lines[i].trim()}`);
                            break;
                        }
                    }
                }
            }
        }
    }
});

console.log("\n=== Sequential Awaits (Waterfalls) ===");
walk('apps/api/src', (filepath) => {
    if (filepath.endsWith('.ts')) {
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
            if (lines[i].trim().startsWith('const') && lines[i].includes(' = await ') && lines[i].includes('prisma') &&
                lines[i+1].trim().startsWith('const') && lines[i+1].includes(' = await ') && lines[i+1].includes('prisma')) {
                console.log(`[Waterfall] ${filepath}:${i+1}`);
                console.log(`   ${lines[i].trim()}`);
                console.log(`   ${lines[i+1].trim()}`);
            }
        }
    }
});

console.log("\n=== Excessive Includes in Prisma ===");
walk('apps/api/src', (filepath) => {
    if (filepath.endsWith('.ts')) {
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('findMany') || lines[i].includes('findUnique') || lines[i].includes('findFirst')) {
                let j = i;
                let includeCount = 0;
                while (j < lines.length && j < i + 20) {
                    if (lines[j].includes('include: {')) {
                        // Count keys roughly
                        let k = j + 1;
                        while (k < lines.length && k < j + 20 && !lines[k].includes('}')) {
                            if (lines[k].includes(': true') || lines[k].includes(': {')) {
                                includeCount++;
                            }
                            k++;
                        }
                        if (includeCount > 3) {
                            console.log(`[Excessive Include (${includeCount})] ${filepath}:${i+1}`);
                        }
                        break;
                    }
                    j++;
                }
            }
        }
    }
});

console.log("\n=== Frontend Large Client Components ===");
walk('apps/web/app', (filepath) => {
    if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
        const content = fs.readFileSync(filepath, 'utf8');
        if (content.includes('"use client"') || content.includes("'use client'")) {
            const lines = content.split('\n');
            if (lines.length > 300) {
                console.log(`[Large Client Component] ${filepath} (${lines.length} lines)`);
            }
            if (content.match(/useEffect/g)?.length > 2) {
                console.log(`[Heavy useEffect] ${filepath}`);
            }
        }
    }
});
