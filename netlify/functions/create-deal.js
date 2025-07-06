exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    
    if (!data.title || !data.newPrice) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Champs title et newPrice obligatoires' 
        })
      };
    }

    // Fonction pour créer un ID unique basé sur le contenu
    function createDealId(title, price, affiliateUrl) {
      // Nettoyer le titre pour la comparaison
      const cleanTitle = title
        .toLowerCase()
        .replace(/[🔥💥✅⚡]/g, '') // Supprimer les emojis
        .replace(/\d+%\s*:\s*/, '') // Supprimer "XX% : "
        .replace(/[^\w\s]/g, '') // Supprimer la ponctuation
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);
      
      // Extraire l'ID produit de l'URL (Amazon ASIN, etc.)
      let productId = '';
      if (affiliateUrl) {
        const asinMatch = affiliateUrl.match(/\/dp\/([A-Z0-9]{10})/);
        const fnacMatch = affiliateUrl.match(/\/w-(\d+)/);
        const generalMatch = affiliateUrl.match(/\/(\d{6,})/);
        
        if (asinMatch) productId = asinMatch[1];
        else if (fnacMatch) productId = fnacMatch[1];
        else if (generalMatch) productId = generalMatch[1];
      }
      
      // Créer un hash simple
      const hashString = `${cleanTitle}-${price}-${productId}`;
      return hashString.replace(/[^\w-]/g, '').substring(0, 40);
    }

    const dealId = createDealId(data.title, data.newPrice, data.affiliateUrl);
    console.log(`Generated deal ID: ${dealId}`);

    // VÉRIFIER SI UN DEAL SIMILAIRE EXISTE DÉJÀ
    try {
      const searchResponse = await fetch(`https://api.github.com/repos/Kamel782/bons-plans-site/contents/content/deals`, {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'User-Agent': 'netlify-function'
        }
      });

      if (searchResponse.ok) {
        const files = await searchResponse.json();
        
        // Chercher un fichier avec le même dealId dans les derniers 7 jours
        const recentFiles = files.filter(file => {
          const fileName = file.name;
          const fileDate = fileName.substring(0, 10); // YYYY-MM-DD
          const daysDiff = (new Date() - new Date(fileDate)) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7 && fileName.includes(dealId);
        });

        if (recentFiles.length > 0) {
          console.log(`Deal similaire trouvé: ${recentFiles[0].name}`);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              message: 'Deal similaire déjà existant (ignoré)',
              existingFile: recentFiles[0].name,
              action: 'skipped'
            })
          };
        }
      }
    } catch (searchError) {
      console.log('Erreur lors de la recherche de doublons:', searchError.message);
      // Continuer même si la recherche échoue
    }

    // CRÉER LE NOUVEAU DEAL
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const daysToExpire = data.daysToExpire || 7;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysToExpire);
    const expiryDateString = expiryDate.toISOString().split('T')[0];

    const slug = data.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);

    // Nom de fichier avec dealId pour éviter les vrais doublons
    const filename = `${date}-${dealId}.md`;
    const filepath = `content/deals/${filename}`;

    const content = `---
title: "${data.title.replace(/"/g, '\\"')}"
date: ${date}T${now.toTimeString().split(' ')[0]}
expiryDate: ${expiryDateString}T23:59:59
draft: false
expired: false
categories: ["${data.category || 'general'}"]
stores: ["${data.store || 'general'}"]
tags: ["promo", "deal", "${data.category || 'general'}"]
oldPrice: ${data.oldPrice || Math.round(data.newPrice * 1.3)}
newPrice: ${data.newPrice}
discount: ${data.discount || Math.round((1 - data.newPrice/(data.oldPrice || data.newPrice * 1.3)) * 100)}
affiliateUrl: "${data.affiliateUrl || '#'}"
couponCode: "${data.couponCode || ''}"
image: "${data.image || '/images/placeholder.jpg'}"
daysValid: ${daysToExpire}
source: "${data.source || 'auto'}"
isValidated: ${data.isValidated || false}
dealId: "${dealId}"
---

${data.description || 'Offre spéciale limitée !'}

---

## 💰 Détails de l'offre

**Prix normal** : ~~${data.oldPrice || Math.round(data.newPrice * 1.3)}€~~  
**Prix promo** : **${data.newPrice}€**  
**Économie** : **${data.discount || Math.round((1 - data.newPrice/(data.oldPrice || data.newPrice * 1.3)) * 100)}%** (${Math.round((data.oldPrice || data.newPrice * 1.3) - data.newPrice)}€)

${data.couponCode ? `### 🎫 Code promo : \`${data.couponCode}\`` : ''}

⏰ **Offre valable jusqu'au ${expiryDateString}**

---

<div style="text-align: center; margin: 30px 0;">
  <a href="${data.affiliateUrl || '#'}" 
     target="_blank" 
     rel="nofollow noopener"
     style="background: linear-gradient(45deg, #ff6b6b, #ff8e8e); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-size: 1.2em; font-weight: bold; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4); transition: all 0.3s ease;">
    🛒 PROFITER DE L'OFFRE
  </a>
</div>

---

⚠️ **Attention** : Les prix peuvent changer à tout moment. Vérifiez le prix final avant l'achat.
`;

    // Créer le fichier (nouveau deal unique)
    const response = await fetch(`https://api.github.com/repos/Kamel782/bons-plans-site/contents/${filepath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'netlify-function'
      },
      body: JSON.stringify({
        message: `Add new deal: ${data.title} (${data.newPrice}€) - ID: ${dealId}`,
        content: Buffer.from(content).toString('base64'),
        branch: 'main'
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('GitHub API Error:', errorData);
      throw new Error(`GitHub API error: ${response.status} - ${errorData}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Nouveau deal créé avec succès',
        filename: filename,
        dealId: dealId,
        action: 'created'
      })
    };

  } catch (error) {
    console.error('Error creating deal:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error.message
      })
    };
  }
};