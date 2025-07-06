const { Octokit } = require("@octokit/rest");

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Gérer preflight
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
    
    console.log('Received deal data:', data);
    
    // Validation des champs requis
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

    // Générer le slug pour le fichier
    const date = new Date().toISOString().split('T')[0];
    const slug = data.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
      .replace(/[^\w\s-]/g, '') // Enlever caractères spéciaux
      .replace(/\s+/g, '-') // Remplacer espaces par tirets
      .replace(/-+/g, '-') // Éviter tirets multiples
      .substring(0, 50); // Limiter la longueur

    // Créer le contenu du fichier Markdown
    const content = `---
title: "${data.title.replace(/"/g, '\\"')}"
date: ${date}T${new Date().toTimeString().split(' ')[0]}
draft: false
categories: ["${data.category || 'general'}"]
stores: ["${data.store || 'general'}"]
tags: ["promo", "deal", "${data.category || 'general'}"]
oldPrice: ${data.oldPrice || Math.round(data.newPrice * 1.3)}
newPrice: ${data.newPrice}
discount: ${data.discount || Math.round((1 - data.newPrice/(data.oldPrice || data.newPrice * 1.3)) * 100)}
affiliateUrl: "${data.affiliateUrl || '#'}"
couponCode: "${data.couponCode || ''}"
image: "${data.image || '/images/placeholder.jpg'}"
---

${data.description || 'Offre spéciale limitée !'}

**Prix normal** : ${data.oldPrice || Math.round(data.newPrice * 1.3)}€  
**Prix promo** : ${data.newPrice}€  
**Économie** : ${data.discount || Math.round((1 - data.newPrice/(data.oldPrice || data.newPrice * 1.3)) * 100)}%

${data.couponCode ? `### Code promo : \`${data.couponCode}\`` : ''}

[Voir l'offre ➡️](${data.affiliateUrl || '#'})
`;

    // Utiliser l'API GitHub pour créer le fichier
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN non configuré');
    }

    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const filename = `${date}-${slug}.md`;
    const filepath = `content/deals/${filename}`;

    console.log('Creating file:', filepath);

    // Créer le fichier dans le repository
    await octokit.repos.createOrUpdateFileContents({
      owner: 'Kamel782', // Remplacez par votre username si différent
      repo: 'bons-plans-site',
      path: filepath,
      message: `Add deal: ${data.title}`,
      content: Buffer.from(content).toString('base64'),
      branch: 'main'
    });

    console.log('File created successfully:', filename);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Deal créé avec succès',
        filename: filename,
        slug: slug,
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
        error: error.message,
        details: error.toString()
      })
    };
  }
};