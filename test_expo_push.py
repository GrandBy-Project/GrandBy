import httpx
import asyncio
import json

async def test_expo_push():
    url = 'https://exp.host/--/api/v2/push/send'
    token = 'ExponentPushToken[1X5NEvNNXOJFdCsT5tBSmS]'
    
    message = {
        'to': token,
        'sound': 'default',
        'title': 'Test Notification',
        'body': 'Expo Push API Response Check',
        'data': {'test': 'true'},
        'priority': 'high',
        'channelId': 'default',
        'badge': 1,
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=[message])
            result = response.json()
            
            print('=== Expo Push API Response ===')
            print(f'Status Code: {response.status_code}')
            print(f'Response: {json.dumps(result, indent=2, ensure_ascii=False)}')
            
            if response.status_code == 200:
                print('✅ API Call Success')
            else:
                print('❌ API Call Failed')
                
    except Exception as e:
        print(f'❌ Error: {str(e)}')

if __name__ == "__main__":
    asyncio.run(test_expo_push())
