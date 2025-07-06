exports.handler = async (event, context) => {
  try {
    const asin = event.queryStringParameters?.asin;
    
    if (!asin) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false,
          error: 'ASIN parameter required' 
        })
      };
    }

    // Vérifier les credentials Amazon
    const hasCredentials = process.env.AMAZON_ACCESS_KEY && 
                          process.env.AMAZON_SECRET_KEY && 
                          process.env.AMAZON_PARTNER_TAG;

    if (!hasCredentials) {
      // Mode simulation en attendant les credentials
      console.log(`Simulation pour ASIN: ${asin}`);
      
      // Base de données de simulation
      const simulatedProducts = {
        'B0CHX1W5Y9': {
          title: 'Apple iPhone 15 Pro 128GB Titane Naturel',
          basePrice: 1229,
          currentDiscount: 15,
          available: true
        },
        'B0B3C2R8MP': {
          title: 'Apple MacBook Air 13" M2 256GB',
          basePrice: 1399,
          currentDiscount: 18,
          available: true
        },
        'B08H93ZRK9': {
          title: 'Sony PlayStation 5',
          basePrice: 549,
          currentDiscount: 8,
          available: true
        },
        'B0BDHWDR12': {
          title: 'Apple AirPods Pro 2ème génération',
          basePrice: 279,
          currentDiscount: 22,
          available: true
        },
        'B096DVBZPX': {
          title: 'Dyson V15 Detect Aspirateur',
          basePrice: 749,
          currentDiscount: 25,
          available: true
        }
      };

      const product = simulatedProducts[asin];
      
      if (!product) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Product not found in simulation database',
            asin: asin
          })
        };
      }

      // Calcul des prix simulés
      const currentPrice = Math.round(product.basePrice * (1 - product.currentDiscount / 100));
      const listPrice = product.basePrice;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          asin: asin,
          title: product.title,
          currentPrice: currentPrice,
          listPrice: listPrice,
          discount: product.currentDiscount,
          available: product.available,
          currency: 'EUR',
          url: `https://www.amazon.fr/dp/${asin}?tag=flashdeal0e-21`,
          lastUpdated: new Date().toISOString(),
          source: 'simulation-mode',
          note: 'Prix simulés en attendant API Amazon'
        })
      };
    }

    // TODO: Code API Amazon réelle (quand credentials disponibles)
    return {
      statusCode: 501,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Amazon API integration en cours',
        note: 'Utilisez le mode simulation pour l\'instant'
      })
    };

  } catch (error) {
    console.error('Function Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        timestamp: new Date().toISOString()
      })
    };
  }
};