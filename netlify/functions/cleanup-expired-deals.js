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
            // Option 1: Supprimer le fichier
            await fetch(`https://api.github.com/repos/Kamel782/bons-plans-site/contents/${file.path}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'netlify-function'
              },
              body: JSON.stringify({
                message: `Remove expired deal: ${file.name}`,
                sha: file.sha,
                branch: 'main'
              })
            });
            
            expiredCount++;
            processedFiles.push(file.name);
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `${expiredCount} deals expirés supprimés`,
        removedFiles: processedFiles,
        totalProcessed: files.length
      })
    };

  } catch (error) {
    console.error('Error cleaning expired deals:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};