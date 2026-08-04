import { http } from './http'

export { createPuzzlePieceChangePayload } from '../utils/puzzle'

export const updatePuzzlePieceState = async (payload) => {
  const response = await http.post('/puzzle/pieces/state', payload)
  return response.data
}
