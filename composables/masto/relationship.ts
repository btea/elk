import type { mastodon } from 'masto'
import type { Ref } from 'vue'

// Batch requests for relationships when used in the UI
// We don't want to hold to old values, so every time a Relationship is needed it
// is requested again from the server to show the latest state

const requestedRelationships = new Map<string, Ref<mastodon.v1.Relationship | undefined>>()
let timeoutHandle: NodeJS.Timeout | undefined

export function useRelationship(account: mastodon.v1.Account): Ref<mastodon.v1.Relationship | undefined> {
  if (!currentUser.value)
    return ref()
  let relationship = requestedRelationships.get(account.id)
  if (relationship)
    return relationship
  relationship = ref<mastodon.v1.Relationship | undefined>()
  requestedRelationships.set(account.id, relationship)
  if (timeoutHandle)
    clearTimeout(timeoutHandle)
  timeoutHandle = setTimeout(() => {
    timeoutHandle = undefined
    fetchRelationships()
  }, 100)
  return relationship
}

async function fetchRelationships() {
  const requested = Array.from(requestedRelationships.entries()).filter(([, r]) => !r.value)
  const relationships = await useMastoClient().v1.accounts.fetchRelationships(requested.map(([id]) => id))
  for (let i = 0; i < requested.length; i++)
    requested[i][1].value = relationships[i]
}

export async function toggleFollowAccount(relationship: mastodon.v1.Relationship, account: mastodon.v1.Account) {
  const { client } = $(useMasto())
  const i18n = useNuxtApp().$i18n

  if (relationship!.following) {
    if (await openConfirmDialog({
      title: i18n.t('confirm.unfollow.title'),
      confirm: i18n.t('confirm.unfollow.confirm'),
      cancel: i18n.t('confirm.unfollow.cancel'),
    }) !== 'confirm')
      return
  }
  relationship!.following = !relationship!.following
  relationship = await client.v1.accounts[relationship!.following ? 'follow' : 'unfollow'](account.id)
}

export async function toggleMuteAccount(relationship: mastodon.v1.Relationship, account: mastodon.v1.Account) {
  const { client } = $(useMasto())
  const i18n = useNuxtApp().$i18n

  if (!relationship!.muting && await openConfirmDialog({
    title: i18n.t('confirm.mute_account.title', [account.acct]),
    confirm: i18n.t('confirm.mute_account.confirm'),
    cancel: i18n.t('confirm.mute_account.cancel'),
  }) !== 'confirm')
    return

  relationship!.muting = !relationship!.muting
  relationship = relationship!.muting
    ? await client.v1.accounts.mute(account.id, {
      // TODO support more options
    })
    : await client.v1.accounts.unmute(account.id)
}

export async function toggleBlockAccount(relationship: mastodon.v1.Relationship, account: mastodon.v1.Account) {
  const { client } = $(useMasto())
  const i18n = useNuxtApp().$i18n

  if (!relationship!.blocking && await openConfirmDialog({
    title: i18n.t('confirm.block_account.title', [account.acct]),
    confirm: i18n.t('confirm.block_account.confirm'),
    cancel: i18n.t('confirm.block_account.cancel'),
  }) !== 'confirm')
    return

  relationship!.blocking = !relationship!.blocking
  relationship = await client.v1.accounts[relationship!.blocking ? 'block' : 'unblock'](account.id)
}

export async function toggleBlockDomain(relationship: mastodon.v1.Relationship, account: mastodon.v1.Account) {
  const { client } = $(useMasto())
  const i18n = useNuxtApp().$i18n

  if (!relationship!.domainBlocking && await openConfirmDialog({
    title: i18n.t('confirm.block_domain.title', [getServerName(account)]),
    confirm: i18n.t('confirm.block_domain.confirm'),
    cancel: i18n.t('confirm.block_domain.cancel'),
  }) !== 'confirm')
    return

  relationship!.domainBlocking = !relationship!.domainBlocking
  await client.v1.domainBlocks[relationship!.domainBlocking ? 'block' : 'unblock'](getServerName(account))
}
