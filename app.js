const express = require('express')
const app = express()
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const startDatabase = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Started')
    })
  } catch (error) {
    console.log(`Server Show ${error}`)
    process.exit(1)
  }
}
startDatabase()

const authentication = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payLoad) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const queryUsername = `SELECT * FROM user WHERE username = '${username}'`
  const dbusername = await db.get(queryUsername)

  if (dbusername === undefined) {
    response.status(400)
    response.send(`Invalid user`)
  } else {
    const passwordMatch = await bcrypt.compare(password, dbusername.password)
    if (passwordMatch === true) {
      const payLoad = {
        username: username,
      }
      const token = jwt.sign(payLoad, 'MY_SECRET_TOKEN')
      response.send({token})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API 2
app.get('/states/', authentication, async (request, response) => {
  const allStatesDetails = `
    SELECT state_id as stateId, state_name as stateName, population
    FROM state`

  const result = await db.all(allStatesDetails)
  response.send(result)
})

//API 3
app.get('/states/:stateId', authentication, async (request, response) => {
  const {stateId} = request.params
  const allStatesDetails = `
    SELECT state_id as stateId, state_name as stateName, population
    FROM state
    WHERE state_id = ${stateId};`

  const result = await db.get(allStatesDetails)
  response.send(result)
})

//API 4
app.post('/districts/', authentication, async (request, response) => {
  const newDistrictDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} =
    newDistrictDetails

  const newDataAdded = `
    INSERT INTO 
      DISTRICT(district_name,state_id,cases,cured,active,deaths)
    VALUES(
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths});`
  await db.run(newDataAdded)
  response.send('District Successfully Added')
})

//API 5
app.get(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const getdistrictDetails = `
    SELECT district_id as districtId ,district_name as districtName,state_id as stateId,cases,cured,active,deaths
    FROM district
    WHERE district_id = ${districtId};`

    const result = await db.get(getdistrictDetails)
    response.send(result)
  },
)

//API 6
app.delete(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrict = `
  DELETE FROM 
    district
  WHERE district_id = ${districtId};`

    await db.run(deleteDistrict)
    response.send('District Removed')
  },
)

//API 7
app.put(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const updateDistrictDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      updateDistrictDetails

    const updateDistrict = `
  UPDATE 
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
  WHERE district_id = ${districtId};`

    await db.run(updateDistrict)
    response.send('District Details Updated')
  },
)

//API 8
app.get(
  '/states/:stateId/stats/',
  authentication,
  async (request, response) => {
    const {stateId} = request.params

    const statsStateId = `
  SELECT total(district.cases) as totalCases,total(district.cured) as totalCured,total(district.active) as totalActive,total(district.deaths) as totalDeaths
  FROM state INNER JOIN district ON state.state_id = district.state_id
  WHERE state.state_id = ${stateId};
  GROUP BY district.state_id`

    const stateresult = await db.get(statsStateId)
    response.send(stateresult)
  },
)

module.exports = app
