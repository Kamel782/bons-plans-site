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
    let deletedCount = 0;
    let deletedFiles = [];

    for (const file of files) {
      if (file.name.endsWith('.md')) {
        // Supprimer le fichier
        await fetch(`https://api.github.com/repos/Kamel782/bons-plans-site/contents/${file.path}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'netlify-function'
          },
          body: JSON.stringify({
            message: `Clean up test deal: ${file.name}`,
            sha: file.sha,
            branch: 'main'
          })
        });
        
        deletedCount++;
        deletedFiles.push(file.name);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `${deletedCount} deals de test supprimés`,
        deletedFiles: deletedFiles
      })
    };

  } catch (error) {
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