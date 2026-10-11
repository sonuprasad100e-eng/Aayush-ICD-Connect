const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OUTPUT_FILE = path.join(__dirname, '../../../data/rag/processed/icd11_tm2_documents.json');

async function getAccessToken(clientId, clientSecret) {
  const tokenUrl = 'https://icdaccessmanagement.who.int/connect/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'icdapi_access',
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data.access_token;
}

// Fetch entity details recursively
async function fetchTm2Data(token) {
  const headers = { 
    'Authorization': 'Bearer ' + token, 
    'Accept': 'application/json', 
    'API-Version': 'v2', 
    'Accept-Language': 'en' 
  };
  
  const chapter26Url = 'https://id.who.int/icd/entity/562274788';
  console.log(`[WHO API] Using Endpoint: ${chapter26Url}`);
  console.log('[WHO API] Using Linearization: Foundation');
  console.log('[WHO API] Target: TM2 Module II');
  
  const records = [];
  const queue = [chapter26Url];
  const visited = new Set([chapter26Url]);
  let activeWorkers = 0;
  let pageCount = 0;
  
  return new Promise((resolve) => {
    const processQueue = async () => {
      // Resolve if queue is empty or we hit our page limit
      if ((queue.length === 0 || pageCount >= 1500) && activeWorkers === 0) {
        console.log(`[WHO API] Finished traversal. Processed ${pageCount} API requests/pages.`);
        resolve(records);
        return;
      }
      
      while (queue.length > 0 && activeWorkers < 20 && pageCount < 1500) {
        const url = queue.shift();
        activeWorkers++;
        pageCount++;
        
        if (pageCount % 100 === 0) {
          console.log(`[WHO API] Processed ${pageCount} pages, queue: ${queue.length}, records: ${records.length}`);
        }
        
        fetch(url, { headers })
          .then(async res => {
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            
            if (data.title && data.title['@value']) {
              const title = data.title['@value'];
              const synonyms = (data.synonym || []).map(t => t.label['@value']);
              const definition = data.definition ? data.definition['@value'] : null;
              const code = data.code || null;
              
              records.push({
                sourceType: 'WHO_FOUNDATION',
                whoEntityUri: data.id || url,
                whoParentUri: data.parent ? data.parent[0] : null,
                whoRelease: '2026-01',
                icd11Tm2Code: code,
                icd11Term: title,
                definition: definition,
                synonyms: synonyms,
                searchableText: `${code || ''} ${title} ${synonyms.join(' ')} ${definition || ''}`.trim()
              });
            }
            
            if (data.child && Array.isArray(data.child)) {
              for (const childUrl of data.child) {
                const secureUrl = childUrl.replace(/^http:\/\//i, 'https://');
                if (!visited.has(secureUrl)) {
                  visited.add(secureUrl);
                  queue.push(secureUrl);
                }
              }
            }
          })
          .catch(e => {
            console.warn(`[WARN] Error fetching ${url}: ${e.message}`);
          })
          .finally(() => {
            activeWorkers--;
            processQueue();
          });
      }
    };
    
    processQueue();
  });
}

async function ingestIcd11() {
  console.log('Starting WHO ICD-11 TM2 Ingestion...');
  const clientId = process.env.ICD_API_CLIENT_ID;
  const clientSecret = process.env.ICD_API_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[ERROR] ICD_API_CLIENT_ID or ICD_API_CLIENT_SECRET not found in .env');
    console.error('Cannot proceed without API credentials.');
    process.exit(1);
  }

  console.log('[INFO] WHO API credentials found. Attempting live authentication...');
  
  let records = [];
  try {
    const token = await getAccessToken(clientId, clientSecret);
    console.log('[INFO] Authentication successful.');
    console.log('[INFO] Token retrieved successfully (hidden for security).');
    
    records = await fetchTm2Data(token);
    
    if (records.length === 0) {
      console.warn('[WARN] Zero TM2 records retrieved from the WHO API. (Module 2 may not be fully published in the requested linearization).');
    }
  } catch (err) {
    console.error('[ERROR] Live API ingestion failed:', err.message);
    process.exit(1);
  }

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records, null, 2));

  console.log('Ingestion Complete.');
  console.log(`Successfully ingested real WHO records: ${records.length}`);
  console.log(`Saved normalized documents to: ${OUTPUT_FILE}`);
}



if (require.main === module) {
  ingestIcd11().catch(console.error);
}

module.exports = { ingestIcd11 };
