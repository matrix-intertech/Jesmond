import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// In local execution this file exists from download
const DATASET_PATH = path.join(__dirname, 'australian_suburbs.json');

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

async function main() {
  console.log('Loading Australian locations dataset...');
  const fileContent = fs.readFileSync(DATASET_PATH, 'utf8');
  const data = JSON.parse(fileContent);

  const country = await prisma.country.upsert({
    where: { isoCode: 'AU' },
    update: {},
    create: { isoCode: 'AU', name: 'Australia' }
  });

  const stateNames: Record<string, string> = {
    'NSW': 'New South Wales',
    'VIC': 'Victoria',
    'QLD': 'Queensland',
    'SA': 'South Australia',
    'WA': 'Western Australia',
    'TAS': 'Tasmania',
    'NT': 'Northern Territory',
    'ACT': 'Australian Capital Territory',
    'OTHER': 'Other Territories'
  };

  const statesData = new Set<string>();
  const citiesMap = new Map<string, any>();
  const suburbsMap = new Map<string, any>();

  let duplicateSourceRowsSkipped = 0;
  let invalidRowsSkipped = 0;

  for (const item of data.data) {
    if (!item.suburb || !item.state || !item.postcode) {
      invalidRowsSkipped++;
      continue;
    }

    const stateCode = item.state;
    const stateName = stateNames[stateCode] || stateCode;
    statesData.add(stateCode);

    const normState = normalizeName(stateName);
    const normSuburb = normalizeName(item.suburb);
    const key = `${normState}_${normSuburb}`;

    let cityName: string | null = null;
    let normCity: string | null = null;

    if (item.urban_area) {
      // Parse main city from urban area (e.g., "Newcastle - Outer West" -> "Newcastle")
      cityName = item.urban_area.split(' - ')[0].trim();
      normCity = normalizeName(cityName);
      const cityKey = `${normState}_${normCity}`;

      if (!citiesMap.has(cityKey)) {
        citiesMap.set(cityKey, {
          name: cityName,
          normalizedName: normCity,
          stateCode
        });
      }
    }

    if (!suburbsMap.has(key)) {
      suburbsMap.set(key, {
        name: item.suburb,
        normalizedName: normSuburb,
        stateCode,
        cityName: cityName,
        postcodes: new Set([String(item.postcode)]),
        lat: item.lat ? parseFloat(item.lat) : null,
        lng: item.lng ? parseFloat(item.lng) : null
      });
    } else {
      duplicateSourceRowsSkipped++;
      suburbsMap.get(key).postcodes.add(String(item.postcode));
    }
  }

  // Insert States
  const stateRecords: Record<string, any> = {};
  let statesCreatedOrUpdated = 0;
  for (const code of statesData) {
    const name = stateNames[code] || code;
    const normName = normalizeName(name);

    const s = await prisma.state.upsert({
      where: { code_countryId: { code, countryId: country.id } },
      update: { name, normalizedName: normName },
      create: { code, name, normalizedName: normName, countryId: country.id }
    });
    stateRecords[code] = s;
    statesCreatedOrUpdated++;
  }

  // Insert Cities
  const cityRecords: Record<string, any> = {};
  let citiesCreatedOrUpdated = 0;
  for (const city of citiesMap.values()) {
    const state = stateRecords[city.stateCode];
    if (state) {
      const c = await prisma.city.upsert({
        where: { normalizedName_stateId: { normalizedName: city.normalizedName, stateId: state.id } },
        update: { name: city.name },
        create: { name: city.name, normalizedName: city.normalizedName, stateId: state.id }
      });
      cityRecords[`${city.stateCode}_${city.normalizedName}`] = c;
      citiesCreatedOrUpdated++;
    }
  }

  // Insert Suburbs
  const suburbsList = Array.from(suburbsMap.values());
  const batchSize = 1000;
  let suburbsCreatedOrUpdated = 0;
  let suburbsWithCityAssigned = 0;
  let suburbsWithoutCityAssigned = 0;

  for (let i = 0; i < suburbsList.length; i += batchSize) {
    const batch = suburbsList.slice(i, i + batchSize);
    console.log(`Processing suburbs batch ${i} to ${i + batch.length}...`);

    for (const sub of batch) {
      const state = stateRecords[sub.stateCode];
      if (!state) {
        invalidRowsSkipped++;
        continue;
      }

      const combinedPostcode = Array.from(sub.postcodes).join(',');

      let mappedCityId = null;
      if (sub.cityName) {
         const cityKey = `${sub.stateCode}_${normalizeName(sub.cityName)}`;
         mappedCityId = cityRecords[cityKey]?.id || null;
      }

      if (mappedCityId) {
        suburbsWithCityAssigned++;
      } else {
        suburbsWithoutCityAssigned++;
      }

      await prisma.$executeRaw`
        INSERT INTO "Suburb" ("id", "stateId", "cityId", "name", "normalizedName", "postcode", "lat", "lng", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${state.id},
          ${mappedCityId},
          ${sub.name},
          ${sub.normalizedName},
          ${combinedPostcode},
          ${sub.lat},
          ${sub.lng},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("stateId", "normalizedName")
        DO UPDATE SET
          "name" = EXCLUDED."name",
          "postcode" = EXCLUDED."postcode",
          "lat" = COALESCE(EXCLUDED."lat", "Suburb"."lat"),
          "lng" = COALESCE(EXCLUDED."lng", "Suburb"."lng"),
          "cityId" = COALESCE(EXCLUDED."cityId", "Suburb"."cityId"), -- Preserve explicit existing relations if source has no city
          "updatedAt" = CURRENT_TIMESTAMP
      `;
      suburbsCreatedOrUpdated++;
    }
  }

  console.log('\n========================================');
  console.log('LOCATION SEED SUMMARY');
  console.log('========================================');
  console.log(`States created/updated: ${statesCreatedOrUpdated}`);
  console.log(`Cities created/updated: ${citiesCreatedOrUpdated}`);
  console.log(`Suburbs created/updated: ${suburbsCreatedOrUpdated}`);
  console.log(`Suburbs mapped to city: ${suburbsWithCityAssigned}`);
  console.log(`Suburbs without city mapping: ${suburbsWithoutCityAssigned}`);
  console.log(`Duplicate source rows skipped: ${duplicateSourceRowsSkipped} (Postcodes merged)`);
  console.log(`Invalid rows skipped: ${invalidRowsSkipped}`);
  console.log('========================================\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
