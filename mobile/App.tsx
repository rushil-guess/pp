import React from 'react'
import { Text, View, SafeAreaView } from 'react-native'

export default function App() {
  return (
    <SafeAreaView style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <View>
        <Text style={{fontSize: 20, fontWeight: '600'}}>Personal AI Career (Expo)</Text>
        <Text style={{marginTop: 8}}>Mobile skeleton — login, dashboard, news, jobs will be added.</Text>
      </View>
    </SafeAreaView>
  )
}
