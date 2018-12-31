module.exports = {
    options: {
        assets: ['**/*.{css,jpg}'],
        baseDir: 'tests/queryString',
        createCopies: false,
        queryString: true,
        removeOldQueryString : true,
    },
    files: [{
        expand: true,
        cwd: 'tests/queryString',
        src: ['css/*.css', '*.html']
    }]
};
