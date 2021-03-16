require 'table_utils'

-- NTYPES = {
--   'total': 0,
--   'feed': 1,
--   'reward': 2,
--   'send': 3,
--   'mention': 4,
--   'follow': 5,
--   'vote': 6,
--   'comment_reply': 7,
--   'post_reply': 8,
--   'account_update': 9,
--   'message': 10,
--   'receive': 11,
--   'donate': 12,
--   'reserved2': 13,
--   'reserved3': 14,
--   'reserved4': 15,
-- }

function notification_add(account, ntype, title, body, url, pic)
  -- print('notification_push -->', account, ntype, title, body, url, pic)
  if ntype ~= 4 then
    local space = box.space.notifications
    local res = space:select{account}
    if #res > 0 then
      -- print_r(res)
      local tuple = res[1]
      -- print('existing:', tuple, #tuple)
      space:update(account, {{'+', 2, 1}, {'+', ntype + 2, 1}})
    else
      local tuple = {account, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
      tuple[ntype + 2] = 1;
      space:insert(tuple)
    end
  end

  local subscriber = box.space.webpush_subscribers:select{account}
  if title and body and #subscriber > 0 then
    subscriber = subscriber[1]
    local last_delivery_time = subscriber[3]
    local last_ntype = subscriber[4]
    local current_time = math.floor(fiber.time())
    if last_deliver_time == nil or (current_time - last_delivery_time) > 120 or last_ntype ~= ntype then
      box.space.notifications_delivery_queue:auto_increment{account, ntype, title, body, url, pic}
    end
  end
end

function notification_read(account, ntype)
  -- print('notification_read -->', account, ntype)
  local space = box.space.notifications
  local res = space:select{account}
  if #res == 0 then return nil end
  local tuple = res[1]
  local count = tuple[ntype + 2]
  if count == nil or count <= 0 then return tuple end
  local res = space:update(account, {{'-', 2, count}, {'=', ntype + 2, 0}})
  return res
end

function add_follower(account, follower)
  local space = box.space.followers
  local res = space:select({account})
  if #res == 0 then return nil end
  local followers = res[1][2]
  if not contains(followers, follower) then
    table.insert(followers, #followers+1, follower)
    space:update(account, {{'=', 2, followers}})
  end
  return true
end

function webpush_subscribe(account, new_subscription)
  local space = box.space.webpush_subscribers
  local res = space:select{account}
  if #res > 0 then
    local subscriptions = res[1][2]
    local new_auth = new_subscription['keys']['auth']
    for k,v in ipairs(subscriptions) do
      if v['keys']['auth'] == new_auth then
        return
      end
    end
    if #subscriptions >= 3 then
       table.remove(subscriptions, 1)
    end
    table.insert(subscriptions, new_subscription)
    space:update(account, {{'=', 2, subscriptions}})
  else
    local tuple = {account, {new_subscription}, nil, nil}
    space:insert(tuple)
  end
end

function webpush_unsubscribe(account, subscription_auth)
  local space = box.space.webpush_subscribers
  local res = space:select{account}
  if #res > 0 then
    local subscriptions = res[1][2]
    for k,v in ipairs(subscriptions) do
      if v['keys']['auth'] == subscription_auth then
        table.remove(subscriptions, k)
      end
      if #subscriptions > 0 then
        space:update(account, {{'=', 2, subscriptions}})
      else
        space:delete{account}
      end
    end
  end
end

function webpush_get_delivery_queue()
  local space = box.space.notifications_delivery_queue
  local queue = space:select{}
  local result = {}
  for k,v in ipairs(queue) do
    local account = v[2]
    local subscription = box.space.webpush_subscribers:select{account}
    if #subscription > 0 then
      subscription = subscription[1]
      table.insert(result, {account, subscription[2], v[4], v[5], v[6], v[7]})
      local current_time = math.floor(fiber.time())
      box.space.webpush_subscribers:update(account, {{'=', 3, current_time}, {'=', 4, v[3]}})
    end
  end
  space:truncate()
  return result
end
