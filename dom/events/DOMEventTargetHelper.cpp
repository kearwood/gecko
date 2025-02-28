/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsContentUtils.h"
#include "nsIDocument.h"
#include "mozilla/Sprintf.h"
#include "nsGlobalWindow.h"
#include "mozilla/dom/ScriptSettings.h"
#include "mozilla/DOMEventTargetHelper.h"
#include "mozilla/EventDispatcher.h"
#include "mozilla/EventListenerManager.h"
#include "mozilla/Likely.h"

namespace mozilla {

using namespace dom;

NS_IMPL_CYCLE_COLLECTION_CLASS(DOMEventTargetHelper)

NS_IMPL_CYCLE_COLLECTION_TRACE_BEGIN(DOMEventTargetHelper)
  NS_IMPL_CYCLE_COLLECTION_TRACE_PRESERVED_WRAPPER
NS_IMPL_CYCLE_COLLECTION_TRACE_END

NS_IMPL_CYCLE_COLLECTION_TRAVERSE_BEGIN_INTERNAL(DOMEventTargetHelper)
  if (MOZ_UNLIKELY(cb.WantDebugInfo())) {
    char name[512];
    nsAutoString uri;
    if (tmp->mOwnerWindow && tmp->mOwnerWindow->GetExtantDoc()) {
      Unused << tmp->mOwnerWindow->GetExtantDoc()->GetDocumentURI(uri);
    }

    nsXPCOMCycleCollectionParticipant* participant = nullptr;
    CallQueryInterface(tmp, &participant);

    SprintfLiteral(name, "%s %s",
                   participant->ClassName(),
                   NS_ConvertUTF16toUTF8(uri).get());
    cb.DescribeRefCountedNode(tmp->mRefCnt.get(), name);
  } else {
    NS_IMPL_CYCLE_COLLECTION_DESCRIBE(DOMEventTargetHelper, tmp->mRefCnt.get())
  }

  NS_IMPL_CYCLE_COLLECTION_TRAVERSE(mListenerManager)
NS_IMPL_CYCLE_COLLECTION_TRAVERSE_END

NS_IMPL_CYCLE_COLLECTION_UNLINK_BEGIN(DOMEventTargetHelper)
  NS_IMPL_CYCLE_COLLECTION_UNLINK_PRESERVED_WRAPPER
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mListenerManager)
  tmp->MaybeDontKeepAlive();
NS_IMPL_CYCLE_COLLECTION_UNLINK_END

NS_IMPL_CYCLE_COLLECTION_CAN_SKIP_BEGIN(DOMEventTargetHelper)
  bool hasLiveWrapper = tmp->HasKnownLiveWrapper();
  if (hasLiveWrapper || tmp->IsCertainlyAliveForCC()) {
    if (tmp->mListenerManager) {
      tmp->mListenerManager->MarkForCC();
    }
    if (!hasLiveWrapper && tmp->PreservingWrapper()) {
      tmp->MarkWrapperLive();
    }
    return true;
  }
NS_IMPL_CYCLE_COLLECTION_CAN_SKIP_END

NS_IMPL_CYCLE_COLLECTION_CAN_SKIP_IN_CC_BEGIN(DOMEventTargetHelper)
  return tmp->HasKnownLiveWrapperAndDoesNotNeedTracing(tmp);
NS_IMPL_CYCLE_COLLECTION_CAN_SKIP_IN_CC_END

NS_IMPL_CYCLE_COLLECTION_CAN_SKIP_THIS_BEGIN(DOMEventTargetHelper)
  return tmp->HasKnownLiveWrapper();
NS_IMPL_CYCLE_COLLECTION_CAN_SKIP_THIS_END

NS_INTERFACE_MAP_BEGIN_CYCLE_COLLECTION(DOMEventTargetHelper)
  NS_WRAPPERCACHE_INTERFACE_MAP_ENTRY
  NS_INTERFACE_MAP_ENTRY(nsISupports)
  NS_INTERFACE_MAP_ENTRY(nsIDOMEventTarget)
  NS_INTERFACE_MAP_ENTRY(dom::EventTarget)
  NS_INTERFACE_MAP_ENTRY(DOMEventTargetHelper)
NS_INTERFACE_MAP_END

NS_IMPL_CYCLE_COLLECTING_ADDREF(DOMEventTargetHelper)
NS_IMPL_CYCLE_COLLECTING_RELEASE_WITH_LAST_RELEASE(DOMEventTargetHelper,
                                                   LastRelease())

NS_IMPL_DOMTARGET_DEFAULTS(DOMEventTargetHelper)

DOMEventTargetHelper::~DOMEventTargetHelper()
{
  if (mParentObject) {
    mParentObject->RemoveEventTargetObject(this);
  }
  if (mListenerManager) {
    mListenerManager->Disconnect();
  }
  ReleaseWrapper(this);
}

void
DOMEventTargetHelper::BindToOwner(nsPIDOMWindowInner* aOwner)
{
  BindToOwner(aOwner ? aOwner->AsGlobal() : nullptr);
}

void
DOMEventTargetHelper::BindToOwner(nsIGlobalObject* aOwner)
{
  if (mParentObject) {
    mParentObject->RemoveEventTargetObject(this);
    if (mOwnerWindow) {
      mOwnerWindow = nullptr;
    }
    mParentObject = nullptr;
    mHasOrHasHadOwnerWindow = false;
  }
  if (aOwner) {
    mParentObject = aOwner;
    aOwner->AddEventTargetObject(this);
    // Let's cache the result of this QI for fast access and off main thread usage
    mOwnerWindow = nsCOMPtr<nsPIDOMWindowInner>(do_QueryInterface(aOwner)).get();
    if (mOwnerWindow) {
      mHasOrHasHadOwnerWindow = true;
    }
  }
}

void
DOMEventTargetHelper::BindToOwner(DOMEventTargetHelper* aOther)
{
  if (!aOther) {
    BindToOwner(static_cast<nsIGlobalObject*>(nullptr));
    return;
  }
  BindToOwner(aOther->GetParentObject());
  mHasOrHasHadOwnerWindow = aOther->HasOrHasHadOwner();
}

void
DOMEventTargetHelper::DisconnectFromOwner()
{
  if (mParentObject) {
    mParentObject->RemoveEventTargetObject(this);
  }
  mOwnerWindow = nullptr;
  mParentObject = nullptr;
  // Event listeners can't be handled anymore, so we can release them here.
  if (mListenerManager) {
    mListenerManager->Disconnect();
    mListenerManager = nullptr;
  }

  MaybeDontKeepAlive();
}

nsPIDOMWindowInner*
DOMEventTargetHelper::GetWindowIfCurrent() const
{
  if (NS_FAILED(CheckInnerWindowCorrectness())) {
    return nullptr;
  }

  return GetOwner();
}

nsIDocument*
DOMEventTargetHelper::GetDocumentIfCurrent() const
{
  nsPIDOMWindowInner* win = GetWindowIfCurrent();
  if (!win) {
    return nullptr;
  }

  return win->GetDoc();
}

NS_IMETHODIMP
DOMEventTargetHelper::RemoveEventListener(const nsAString& aType,
                                          nsIDOMEventListener* aListener,
                                          bool aUseCapture)
{
  EventListenerManager* elm = GetExistingListenerManager();
  if (elm) {
    elm->RemoveEventListener(aType, aListener, aUseCapture);
  }

  return NS_OK;
}

NS_IMPL_REMOVE_SYSTEM_EVENT_LISTENER(DOMEventTargetHelper)

NS_IMETHODIMP
DOMEventTargetHelper::AddEventListener(const nsAString& aType,
                                       nsIDOMEventListener* aListener,
                                       bool aUseCapture,
                                       bool aWantsUntrusted,
                                       uint8_t aOptionalArgc)
{
  NS_ASSERTION(!aWantsUntrusted || aOptionalArgc > 1,
               "Won't check if this is chrome, you want to set "
               "aWantsUntrusted to false or make the aWantsUntrusted "
               "explicit by making aOptionalArgc non-zero.");

  if (aOptionalArgc < 2) {
    nsresult rv = WantsUntrusted(&aWantsUntrusted);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  EventListenerManager* elm = GetOrCreateListenerManager();
  NS_ENSURE_STATE(elm);
  elm->AddEventListener(aType, aListener, aUseCapture, aWantsUntrusted);
  return NS_OK;
}

void
DOMEventTargetHelper::AddEventListener(const nsAString& aType,
                                       EventListener* aListener,
                                       const AddEventListenerOptionsOrBoolean& aOptions,
                                       const Nullable<bool>& aWantsUntrusted,
                                       ErrorResult& aRv)
{
  bool wantsUntrusted;
  if (aWantsUntrusted.IsNull()) {
    nsresult rv = WantsUntrusted(&wantsUntrusted);
    if (NS_FAILED(rv)) {
      aRv.Throw(rv);
      return;
    }
  } else {
    wantsUntrusted = aWantsUntrusted.Value();
  }

  EventListenerManager* elm = GetOrCreateListenerManager();
  if (!elm) {
    aRv.Throw(NS_ERROR_UNEXPECTED);
    return;
  }

  elm->AddEventListener(aType, aListener, aOptions, wantsUntrusted);
}

NS_IMETHODIMP
DOMEventTargetHelper::AddSystemEventListener(const nsAString& aType,
                                             nsIDOMEventListener* aListener,
                                             bool aUseCapture,
                                             bool aWantsUntrusted,
                                             uint8_t aOptionalArgc)
{
  NS_ASSERTION(!aWantsUntrusted || aOptionalArgc > 1,
               "Won't check if this is chrome, you want to set "
               "aWantsUntrusted to false or make the aWantsUntrusted "
               "explicit by making aOptionalArgc non-zero.");

  if (aOptionalArgc < 2) {
    nsresult rv = WantsUntrusted(&aWantsUntrusted);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_AddSystemEventListener(this, aType, aListener, aUseCapture,
                                   aWantsUntrusted);
}

NS_IMETHODIMP
DOMEventTargetHelper::DispatchEvent(nsIDOMEvent* aEvent, bool* aRetVal)
{
  nsEventStatus status = nsEventStatus_eIgnore;
  nsresult rv =
    EventDispatcher::DispatchDOMEvent(this, nullptr, aEvent, nullptr, &status);

  *aRetVal = (status != nsEventStatus_eConsumeNoDefault);
  return rv;
}

nsresult
DOMEventTargetHelper::DispatchTrustedEvent(const nsAString& aEventName)
{
  RefPtr<Event> event = NS_NewDOMEvent(this, nullptr, nullptr);
  event->InitEvent(aEventName, false, false);

  return DispatchTrustedEvent(event);
}

nsresult
DOMEventTargetHelper::DispatchTrustedEvent(nsIDOMEvent* event)
{
  event->SetTrusted(true);

  bool dummy;
  return DispatchEvent(event, &dummy);
}

nsresult
DOMEventTargetHelper::GetEventTargetParent(EventChainPreVisitor& aVisitor)
{
  aVisitor.mCanHandle = true;
  aVisitor.SetParentTarget(nullptr, false);
  return NS_OK;
}

nsresult
DOMEventTargetHelper::PostHandleEvent(EventChainPostVisitor& aVisitor)
{
  return NS_OK;
}

EventListenerManager*
DOMEventTargetHelper::GetOrCreateListenerManager()
{
  if (!mListenerManager) {
    mListenerManager = new EventListenerManager(this);
  }

  return mListenerManager;
}

EventListenerManager*
DOMEventTargetHelper::GetExistingListenerManager() const
{
  return mListenerManager;
}

nsIScriptContext*
DOMEventTargetHelper::GetContextForEventHandlers(nsresult* aRv)
{
  *aRv = CheckInnerWindowCorrectness();
  if (NS_FAILED(*aRv)) {
    return nullptr;
  }
  nsPIDOMWindowInner* owner = GetOwner();
  return owner ? nsGlobalWindowInner::Cast(owner)->GetContextInternal()
               : nullptr;
}

nsresult
DOMEventTargetHelper::WantsUntrusted(bool* aRetVal)
{
  nsresult rv = CheckInnerWindowCorrectness();
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDocument> doc = GetDocumentIfCurrent();
  // We can let listeners on workers to always handle all the events.
  *aRetVal = (doc && !nsContentUtils::IsChromeDoc(doc)) || !NS_IsMainThread();
  return rv;
}

void
DOMEventTargetHelper::EventListenerAdded(nsAtom* aType)
{
  EventListenerWasAdded(Substring(nsDependentAtomString(aType), 2),
                        IgnoreErrors());
  MaybeUpdateKeepAlive();
}

void
DOMEventTargetHelper::EventListenerAdded(const nsAString& aType)
{
  EventListenerWasAdded(aType, IgnoreErrors());
  MaybeUpdateKeepAlive();
}

void
DOMEventTargetHelper::EventListenerRemoved(nsAtom* aType)
{
  EventListenerWasRemoved(Substring(nsDependentAtomString(aType), 2),
                          IgnoreErrors());
  MaybeUpdateKeepAlive();
}

void
DOMEventTargetHelper::EventListenerRemoved(const nsAString& aType)
{
  EventListenerWasRemoved(aType, IgnoreErrors());
  MaybeUpdateKeepAlive();
}

void
DOMEventTargetHelper::KeepAliveIfHasListenersFor(const nsAString& aType)
{
  mKeepingAliveTypes.mStrings.AppendElement(aType);
  MaybeUpdateKeepAlive();
}

void
DOMEventTargetHelper::KeepAliveIfHasListenersFor(nsAtom* aType)
{
  mKeepingAliveTypes.mAtoms.AppendElement(aType);
  MaybeUpdateKeepAlive();
}

void
DOMEventTargetHelper::IgnoreKeepAliveIfHasListenersFor(const nsAString& aType)
{
  mKeepingAliveTypes.mStrings.RemoveElement(aType);
  MaybeUpdateKeepAlive();
}

void
DOMEventTargetHelper::IgnoreKeepAliveIfHasListenersFor(nsAtom* aType)
{
  mKeepingAliveTypes.mAtoms.RemoveElement(aType);
  MaybeUpdateKeepAlive();
}

void
DOMEventTargetHelper::MaybeUpdateKeepAlive()
{
  bool shouldBeKeptAlive = false;

  if (!mKeepingAliveTypes.mAtoms.IsEmpty()) {
    for (uint32_t i = 0; i < mKeepingAliveTypes.mAtoms.Length(); ++i) {
      if (HasListenersFor(mKeepingAliveTypes.mAtoms[i])) {
        shouldBeKeptAlive = true;
        break;
      }
    }
  }

  if (!shouldBeKeptAlive && !mKeepingAliveTypes.mStrings.IsEmpty()) {
    for (uint32_t i = 0; i < mKeepingAliveTypes.mStrings.Length(); ++i) {
      if (HasListenersFor(mKeepingAliveTypes.mStrings[i])) {
        shouldBeKeptAlive = true;
        break;
      }
    }
  }

  if (shouldBeKeptAlive == mIsKeptAlive) {
    return;
  }

  mIsKeptAlive = shouldBeKeptAlive;
  if (mIsKeptAlive) {
    AddRef();
  } else {
    Release();
  }
}

void
DOMEventTargetHelper::MaybeDontKeepAlive()
{
  if (mIsKeptAlive) {
    mIsKeptAlive = false;
    Release();
  }
}

} // namespace mozilla
