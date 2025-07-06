const crypto = require('crypto');
const fetch = require('node-fetch');

// Configuration Amazon PA API 5.0
const AMAZON_CONFIG = {
  accessKey: process.env.AMAZON_ACCESS_KEY,
  secretKey: process.env.AMAZON_SECRET_KEY,
  partnerTag: process.env.AMAZON_PARTNER_TAG,
  host: 'webservices.amazon.fr',
  region: 'eu-west-1',
  service: 'ProductAdvertisingAPI'
};

// Fonction pour signer les requêtes Amazon
function signRequest(method, url, headers, payload) {
  const { accessKey, secretKey, region, service } = AMAZON_CONFIG;
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const date = new Date();
  const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeString = date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
  
  // Créer la signature AWS4
  const credentialScope = `${dateString}/${region}/${service}/aws4_request`;
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key]}`)
    .join('\n') + '\n';
  
  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');
  
  const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');
  
  const canonicalRequest = [
    method,
    url,
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload
  ].join('\n');
  
  const stringToSign = [
    algorithm,
    timeString,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  
  const signingKey = getSignatureKey(secretKey, dateString, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  
  const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    ...headers,
    'Authorization': authorizationHeader,
    'X-Amz-Date': timeString
  };
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

exports.handler = async (event, context) => {
  try {
    const asin = event.queryStringParameters?.asin;
    
    if (!asin) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'ASIN parameter required' })
      };
    }

    // Vérifier la configuration
    if (!AMAZON_CONFIG.accessKey || !AMAZON_CONFIG.secretKey || !AMAZON_CONFIG.partnerTag) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Amazon API credentials not configured',
          note: 'Waiting for Amazon Associates approval'
        })
      };
    }

    // Préparer la requête Amazon PA API
    const requestPayload = {
      ItemIds: [asin],
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.Features', 
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Offers.Summaries.HighestPrice',
        'Offers.Summaries.LowestPrice',
        'Images.Primary.Large',
        'ItemInfo.ProductInfo'
      ],
      PartnerTag: AMAZON_CONFIG.partnerTag,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.fr'
    };

    const requestBody = JSON.stringify(requestPayload);
    
    // Headers requis pour Amazon PA API
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': AMAZON_CONFIG.host,
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
      'Content-Length': Buffer.byteLength(requestBody)
    };

    // Signer la requête
    const signedHeaders = signRequest('POST', '/', headers, requestBody);

    // Faire l'appel à Amazon
    const response = await fetch(`https://${AMAZON_CONFIG.host}/paapi5/getitems`, {
      method: 'POST',
      headers: signedHeaders,
      body: requestBody
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Amazon API Error:', data);
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Amazon API Error',
          details: data,
          asin: asin
        })
      };
    }

    // Traiter la réponse Amazon
    if (data.ItemsResult && data.ItemsResult.Items && data.ItemsResult.Items.length > 0) {
      const item = data.ItemsResult.Items[0];
      
      // Extraire les prix
      const offers = item.Offers?.Listings?.[0];
      const currentPrice = offers?.Price?.Amount ? offers.Price.Amount / 100 : null;
      const listPrice = offers?.SavingBasis?.Amount ? offers.SavingBasis.Amount / 100 : null;
      
      // Calculer la réduction
      let discount = 0;
      if (listPrice && currentPrice && listPrice > currentPrice) {
        discount = Math.round((1 - currentPrice / listPrice) * 100);
      }

      // Vérifier la disponibilité
      const available = !!currentPrice && offers?.Availability?.Type === 'Now';

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          asin: asin,
          title: item.ItemInfo?.Title?.DisplayValue || 'Product Title',
          currentPrice: currentPrice,
          listPrice: listPrice || (currentPrice ? currentPrice * 1.3 : null),
          discount: discount,
          available: available,
          currency: 'EUR',
          url: `https://www.amazon.fr/dp/${asin}?tag=${AMAZON_CONFIG.partnerTag}`,
          lastUpdated: new Date().toISOString(),
          source: 'amazon-paapi5'
        })
      };

    } else {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false,
          error: 'Product not found',
          asin: asin
        })
      };
    }

  } catch (error) {
    console.error('Function Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};