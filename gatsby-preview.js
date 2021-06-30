const fetch = require('node-fetch')
const fs = require('fs')

/**
 * Download Schema
 */
const downloadGraphqlSchema = () => {
  const url = 'https://imlmarketing.wpengine.com/graphql'
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      variables: {},
      query: `
    {
        __schema {
        types {
            kind
            name
            possibleTypes {
            name
            }
        }
        }
    }
    `,
    }),
  })
    .then(result => result.json())
    .then(result => {
      // here we're filtering out any type information unrelated to unions or interfaces
      const filteredData = result.data.__schema.types.filter(
        type => type.possibleTypes !== null
      )
      result.data.__schema.types = filteredData
      fs.writeFileSync(
        './src/config/graphql/dist/fragmentTypes.json',
        JSON.stringify(result.data),
        err => {
          if (err) {
            console.error('Error writing fragmentTypes file', err)
          } else {
            console.log('Fragment types successfully extracted!')
          }
        }
      )
    })
}

/**
 * Generate preview fragments
 */
const generatePreviewFragments = () => {
  var lineReader = require('readline').createInterface({
    input: require('fs').createReadStream('src/config/graphql/fragments.js'),
  })

  /**
   * Parser keywords
   */
  const startParser = '### fp-start'
  const endParser = '### fp-end'
  const regExp = /\(([^)]+)\)/

  /**
   * Skip specific lines
   */
  const skipLines = [
    {
      key: 'imageFile',
      lines: 3,
    },
  ]

  /**
   * Cleaning service
   * @param {*} content
   */
  const parseContent = content => {
    return content
      .replace(/WordPress_/g, '')
      .replace(/blocks/g, 'previewBlocks')
  }

  /**
   * Reader variables
   */
  let readLine = false
  let skipLinesCounter = 0
  let currentParser = ''
  let groups = {}
  lineReader
    .on('line', function(line) {
      // Remember if previous line was okay to read
      let preReadLine = readLine

      /**
       * If hit starter parse init group and start read
       */
      if (line.indexOf(startParser) >= 0) {
        readLine = true
        currentParser = regExp.exec(line)[1]
        if (!groups[currentParser]) groups[currentParser] = ''
      }
      /**
       * If end of parser stop read
       */
      if (line.indexOf(endParser) >= 0) {
        readLine = false
      }

      /**
       * If its okay to read line do so
       */
      if (preReadLine && readLine) {
        skipLines.forEach(skipLine => {
          if (line.indexOf(skipLine.key) >= 0) {
            skipLinesCounter = skipLine.lines
          }
        })

        if (skipLinesCounter > 0) {
          skipLinesCounter--
          return false
        }

        groups[currentParser] += line + '\n'
      }
    })
    .on('close', function() {
      let output = ''
      /**
       * Group lines
       */
      Object.keys(groups).forEach(group => {
        const parsedContent = parseContent(groups[group])
        output += `/**\n`
        output += ` * Generated fragment for ${group}\n`
        output += ` */\n`
        output += `export const ${group} = \`\n`
        output += parsedContent
        output += '`\n\n'
      })

      fs.writeFile('src/config/graphql/dist/fragments.js', output, function(
        err
      ) {
        if (err) return console.log(err)
      })
    })
}

/**
 * Inits
 */
downloadGraphqlSchema()
generatePreviewFragments()