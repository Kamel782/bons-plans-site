const { Octokit } = require("@octokit/rest");

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

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    
    // Calcul de la date d'expiration (par défaut 7 jours)
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
      .substring(0, 50);

    // Contenu avec date d'expiration
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
---

${data.description || 'Offre spéciale limitée !'}

**Prix normal** : ${data.oldPrice || Math.round(data.newPrice * 1.3)}€  
**Prix promo** : ${data.newPrice}€  
**Économie** : ${data.discount || Math.round((1 - data.newPrice/(data.oldPrice || data.newPrice * 1.3)) * 100)}%

${data.couponCode ? `### Code promo : \`${data.couponCode}\`` : ''}

⏰ **Offre valable jusqu'au ${expiryDateString}**

[Voir l'offre ➡️](${data.affiliateUrl || '#'})
`;

    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN non configuré');
    }

    const filename = `${date}-${slug}.md`;
    const filepath = `content/deals/${filename}`;

    const response = await fetch(`https://api.github.com/repos/Kamel782/bons-plans-site/contents/${filepath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'netlify-function'
      },
      body: JSON.stringify({
        message: `Add deal: ${data.title} (expires: ${expiryDateString})`,
        content: Buffer.from(content).toString('base64'),
        branch: 'main'
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Deal créé avec succès',
        filename: filename,
        slug: slug,
        expiryDate: expiryDateString,
        url: `https://flashdeal.netlify.app/deals/${date}-${slug}/`
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