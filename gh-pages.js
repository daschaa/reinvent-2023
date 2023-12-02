var ghpages = require('gh-pages');

ghpages.publish(
    'public',
    {
        branch: 'gh-pages',
        repo: 'https://github.com/daschaa/reinvent-2023.git',
        user: {
            name: 'Joshua Weber',
            email: 'josh@joshuaw.de'
        }
    },
    () => {
        console.log('Deploy Complete!')
    }
)
