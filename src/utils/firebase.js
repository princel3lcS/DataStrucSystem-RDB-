import db from '@/config/firebase'
import firebase from '@firebase/app'
import '@firebase/auth'

async function verifyLogin (data, params, userRef) {
  let prepareResults = {}
  if (data && data.FIRST_LOGIN) {
    prepareResults = {
      success: 1,
      message: 'Student is First Login.',
      data: {
        ...data,
        userRef
      }
    }
  } else if (data) {
    await firebase.auth().signInWithEmailAndPassword(params.id + '@email.com', params.pass).then(() => {
      prepareResults = {
        success: 1,
        message: `Welcome <b>${params.id}</b> EIEI :)`,
        data: {
          ...data,
          userRef
        }
      }
    }).catch(err => {
      prepareResults = {
        success: 0,
        message: `logging in failed, ${err}`
      }
    })
  } else {
    prepareResults = {
      success: 0,
      message: `haven't Username <b>${params.id}</b>`
    }
  }
  return prepareResults
}
export default {
  verifyUserLogin (params) {
    return new Promise((resolve, reject) => {
      let prepareResults = {}
      const stdRef = db.ref(`students/${params.id}`)
      const taRef = db.ref(`ta/${params.id}`)
      stdRef.on('value', async (data) => {
        if (data.exists()) {
          prepareResults = await verifyLogin(data.val(), params, stdRef)
        } else {
          taRef.on('value', async (data) => {
            prepareResults = await verifyLogin(data.val(), params, taRef)
          })
        }
        resolve(prepareResults)
      })
    })
  },
  setPassword (params) {
    return new Promise((resolve, reject) => {
      if (params.isChangePass) {
        let user = firebase.auth().currentUser
        user.updatePassword(params.pass).then(() => {
          db.ref(`${params.identity}/${params.id}`).update({
            FIRST_LOGIN: 0
          })
          resolve('update password successful.')
        }).catch((error) => {
          console.log(error, 'updatePassword')
          reject(error)
        })
      } else {
        firebase.auth().createUserWithEmailAndPassword(params.id + '@email.com', params.pass).then(() => {
          db.ref(`${params.identity}/${params.id}`).update({
            FIRST_LOGIN: 0
          })
          resolve('set password successful.')
        }).catch((error) => {
          console.log(error, 'createUserWithEmailAndPassword')
          reject(error)
        })
      }
    })
  },
  setReservTime (params, userLogin) {
    return new Promise((resolve, reject) => {
      const taRef = db.ref(`ta/${params.TA}`)
      const stdRef = db.ref(`students/${userLogin['.key']}`)
      taRef.transaction(taVal => {
        const index = taVal.schedules.findIndex(obj => obj.time === params.time)
        if (params.status) {
          if (taVal.schedules[index].ID) {
            resolve(false)
          } else {
            taVal.schedules[index] = {
              ID: userLogin['.key'],
              name: userLogin.name,
              time: params.time
            }
            taRef.update({ schedules: taVal.schedules })
          }
          stdRef.update({
            schedule: {
              TA: params.TA,
              time: params.time
            }
          })
          resolve(true)
        } else {
          taVal.schedules[index] = {
            time: params.time
          }
          taRef.update({ schedules: taVal.schedules })
          stdRef.update({
            schedule: {
              TA: '',
              time: ''
            }
          })
          resolve(true)
        }
      })
    })
  },
  initData (userLogin) {
    return new Promise((resolve, reject) => {
      const stdRef = db.ref(`students/${userLogin['.key']}`)
      stdRef.once('value').then((stdData) => {
        if (stdData.val().schedule.TA) {
          const taRef = db.ref(`ta/${stdData.val().schedule.TA}`)
          taRef.once('value', (taData) => {
            const index = taData.val().schedules.findIndex(obj => obj.ID === userLogin['.key'])
            if (index === -1) {
              stdRef.update({
                schedule: {
                  TA: '',
                  time: ''
                }
              })
              resolve(true)
            }
          })
        }
      })
    })
  },
  async setAuthentication (userLogin) {
    try {
      await firebase.auth().signInWithEmailAndPassword(userLogin['.key'] + '@email.com', userLogin.password)
    } catch (error) {
      console.log(error.message)
    }
  },
  firebaseLogout () {
    firebase.auth().signOut().then(() => {
      console.log('Sign-out successful.')
    }).catch((error) => {
      console.log('An error happened.', error.message)
    })
  }
}
