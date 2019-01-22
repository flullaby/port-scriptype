const fs = require('fs')
const Handlebars = require('handlebars')

const {
  htmlInput,
  htmlOutput,
  lastCommitHash
} = process.env

const html = fs.readFileSync(htmlInput, 'utf-8')
const template = Handlebars.compile(html)

const templateData = {
  lastCommitHash,
  lastBuildTime: new Date().toUTCString(),
  yearsOfExperience: new Date().getUTCFullYear() - 2013
}

const output = template(templateData)

fs.writeFileSync(htmlOutput, output)
