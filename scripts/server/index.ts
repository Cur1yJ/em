import * as Y from 'yjs'

// import Routes from '../../src/@types/Routes'
// import Share from '../../src/@types/Share'

const { getYDoc, createServer } = require('y-websocket-auth/server')

const host = process.env.HOST || 'localhost'
const port = process.env.PORT || 8080
const PERMISSIONS_DOCID = 'permissions'

/** An access token for sharing a thoughtspace. */
interface Share {
  // ISOString
  accessed: string
  created: string
  name?: string
  role: 'owner'
}

/**
 * All thoughtspace permissions. Mirrors Websocket documents at DOCID/permissions. Must be loaded into memory so that permissions are available for authentication.
 *
 * Persisted to YPERMISSIONS (default: .permissions.level).
 *
 * @example
 *   {
 *     [docid]: {
 *       [accessToken]: [role]
 *     }
 *   }
 */
const ydoc = new Y.Doc()
if (process.env.YPERMISSIONS && !Math) {
  const LeveldbPersistence = require('y-leveldb').LeveldbPersistence
  // do not use process.env.YPERSISTENCE or it will overwrite the thoughtspace leveldb
  const ldb = new LeveldbPersistence(process.env.YPERMISSIONS)
  ;(async () => {
    const persistedYdoc = await ldb.getYDoc(PERMISSIONS_DOCID)
    const newUpdates = Y.encodeStateAsUpdate(ydoc)
    ldb.storeUpdate(PERMISSIONS_DOCID, newUpdates)
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc))
    ydoc.on('update', update => {
      ldb.storeUpdate(PERMISSIONS_DOCID, update)
    })
  })()
}

/** Authenticates the access token. */
export const authenticate = (accessToken: string, { name, params }: { name: string; params: any }) => {
  const tsid = name.endsWith('/permissions') ? name.split('/permissions')[0] : name
  console.log('authenticate', { name, tsid })
  const permissionsDocName = `${tsid}/permissions`
  const permissionsDoc: Y.Doc = getYDoc(permissionsDocName)
  const yPermissionsServer = ydoc.getMap<Share>(tsid)
  let share = yPermissionsServer.get(accessToken)

  // if the document has no owner, automatically assign the current user as owner
  if (yPermissionsServer.size === 0) {
    console.info(`assigning owner ${accessToken} to new thoughtspace ${tsid}`, { name })
    share = { accessed: new Date().toISOString(), created: new Date().toISOString(), name: 'Owner', role: 'owner' }
    yPermissionsServer.set(accessToken, share)
  }

  // Copy permissions from the server-side permissions doc to the client-side permission doc.
  // The server-side permissions doc keeps all permissions for all documents into memory.
  // The client-side permissions doc uses authentication and can be exposed to the client via websocket.
  if (share?.role === 'owner' && params.type === 'auth') {
    // update last accessed time on auth
    yPermissionsServer.set(accessToken, { ...share, accessed: new Date().toISOString() })
    const yPermissionsClient = permissionsDoc.getMap<Share>(PERMISSIONS_DOCID)
    yPermissionsServer.forEach((share, accessToken) => {
      yPermissionsClient.set(accessToken, share)
    })
  }

  return share?.role === 'owner'
}

const routes: { [key: string]: (...props: any) => any } = {
  'share/add': ({
    auth,
    accessToken,
    docid,
    name,
    role,
  }: {
    auth: string
    accessToken: string
    docid: string
    name?: string
    role: 'owner'
  }) => {
    const shareNew = { accessed: new Date().toISOString(), created: new Date().toISOString(), name, role }
    const permissionsDocName = `${docid}/permissions`
    const permissionsDoc: Y.Doc = getYDoc(permissionsDocName)
    const yPermissionsServer = ydoc.getMap<Share>(docid)
    const yPermissionsClient = permissionsDoc.getMap<Share>(PERMISSIONS_DOCID)
    const share = yPermissionsServer.get(auth)
    if (!share) {
      console.error('Error: Permissions no longer exists', { docid, accessToken })
      console.error({ server: yPermissionsServer.toJSON(), client: yPermissionsClient.toJSON() })
      return {
        error: `Thoughtspace no longer exists: ${accessToken}`,
      }
    }
    yPermissionsServer.set(accessToken, shareNew)
    yPermissionsClient.set(accessToken, shareNew)
  },
  'share/delete': ({ accessToken, docid }) => {
    const permissionsDocName = `${docid}/permissions`
    const permissionsDoc: Y.Doc = getYDoc(permissionsDocName)
    const yPermissionsServer = ydoc.getMap<Share>(docid)
    const yPermissionsClient = permissionsDoc.getMap<Share>(PERMISSIONS_DOCID)
    console.error({ server: yPermissionsServer.toJSON(), client: yPermissionsClient.toJSON() })
    yPermissionsServer.delete(accessToken)
    yPermissionsClient.delete(accessToken)
  },
  'share/update': ({ accessToken, docid, name, role }) => {
    const permissionsDocName = `${docid}/permissions`
    const permissionsDoc: Y.Doc = getYDoc(permissionsDocName)
    const yPermissionsServer = ydoc.getMap<Share>(docid)
    const yPermissionsClient = permissionsDoc.getMap<Share>(PERMISSIONS_DOCID)
    const share = yPermissionsServer.get(accessToken)
    if (!share) {
      console.error('Error: Permissions no longer exists', { docid, accessToken })
      console.error({ server: yPermissionsServer.toJSON(), client: yPermissionsClient.toJSON() })
      return {
        error: `Thoughtspace no longer exists: ${accessToken}`,
      }
    }
    const shareNew = { ...share, name, role }
    yPermissionsServer.set(accessToken, shareNew)
    yPermissionsClient.set(accessToken, shareNew)
  },
}

createServer({ authenticate, routes }).listen(port, host, () => {
  console.info(`server running at '${host}' on port ${port}`)
})
