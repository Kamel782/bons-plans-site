exports.handler = async (event, context) => {
  try {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN non configuré');
    }

    // Récupérer tous les fichiers de deals
    const response = await fetch(`https://api.github.com/repos/Kamel782/bons-plans-site/contents/content/deals`, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'netlify-function'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const files = await response.json();
    const today = new Date().toISOString().split('T')[0];
    let expiredCount = 0;
    let processedFiles = [];
    let keptFiles = [];

    for (const file of files) {
      if (file.name.endsWith('.md')) {
        // Récupérer le contenu du fichier
        const fileResponse = await fetch(file.download_url);
        const content = await fileResponse.text();
        
        // Extraire la date d'expiration
        const expiryMatch = content.match(/expiryDate:\s*(\d{4}-\d{2}-\d{2})/);
        
        if (expiryMatch) {
          const expiryDate = expiryMatch[1];
          
          // Vérifier si le deal est expiré
          if (expiryDate < today) {
            // Supprimer le fichier expiré
            await fetch(`https://api.github.com/repos/Kamel782/bons-plans-site/contents/${file.path}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'netlify-function'
              },
              body: JSON.stringify({
                message: `Auto-cleanup: Remove expired deal ${file.name}`,
                sha: file.sha,
                branch: 'main'
              })
            });
            
            expiredCount++;
            processedFiles.push({
              name: file.name,
              expiryDate: expiryDate,
              action: 'deleted'
            });
          } else {
            keptFiles.push({
              name: file.name,
              expiryDate: expiryDate,
              daysLeft: Math.ceil((new Date(expiryDate) - new Date(today)) / (1000 * 60 * 60 * 24))
            });
          }
        } else {
          // Fichier sans date d'expiration - on le garde
          keptFiles.push({
            name: file.name,
            expiryDate: 'no-expiry',
            daysLeft: 'permanent'
          });
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `Nettoyage automatique terminé`,
        statistics: {
          totalFiles: files.length,
          expiredDeleted: expiredCount,
          activeDeals: keptFiles.length,
          cleanupDate: today
        },
        expiredDeals: processedFiles,
        activeDeals: keptFiles.slice(0, 10) // Limiter à 10 pour éviter trop de données
      })
    };

  } catch (error) {
    console.error('Error cleaning expired deals:', error);
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