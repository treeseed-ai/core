import type { ContactRoutingMap, ContactType } from '../../types/forms';

export function resolveContactRecipientsFromMap(routingMap: ContactRoutingMap, contactType: ContactType) {
	const recipients = routingMap[contactType]?.length ? routingMap[contactType] : routingMap.default;
	return recipients ?? [];
}
