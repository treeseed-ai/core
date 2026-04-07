import { getContactRoutingMap, getSubscribeRecipients } from './config';
import type { ContactType } from '../../types/forms';
import { resolveContactRecipientsFromMap } from './routing-core';

export function resolveContactRecipients(contactType: ContactType) {
	const routingMap = getContactRoutingMap();
	return resolveContactRecipientsFromMap(routingMap, contactType);
}

export function resolveSubscribeRecipients() {
	return getSubscribeRecipients();
}
