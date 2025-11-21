import type { H3Event } from 'h3'
import { render } from '../helpers/templates'

export default defineEventHandler(async (event: H3Event) => {
  const pageContext = {
    title: 'Post Killmail | EVE-KILL',
    description: 'Manually post a killmail using an ESI link',
    keywords: 'eve online, killmail, post, submit'
  }

  return render('pages/post.hbs', pageContext, {}, event)
})
