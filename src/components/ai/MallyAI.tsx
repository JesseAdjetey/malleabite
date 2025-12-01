// Enhanced MallyAI component with Schedule Optimization (Phase 1.4)
import React, { useState } from "react";
import {
  Bot,
  Send,
  X,
  Sparkles,
  Brain,
  Calendar,
  Zap,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext.firebase";
import { CalendarEventType } from "@/lib/stores/types";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { findFreeTimeBlocks } from "@/lib/algorithms/time-blocks";
import { useAnalyticsData } from "@/hooks/use-analytics-data";
import dayjs from 'dayjs';

export default function MallyAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [messages, setMessages] = useState<Array<{
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
  }>>([]);

  const { user } = useAuth();
  const { events, fetchEvents } = useCalendarEvents();
  const { metrics, timeDistribution } = useAnalyticsData();

  const handleOptimizeSchedule = () => {
    setShowOptimizer(true);
    setIsLoading(true);

    try {
      // Analyze current week's schedule
      const today = new Date();
      const analysis = findFreeTimeBlocks(today.toISOString(), events);
      
      // Calculate productivity score from thisWeek data
      const thisWeek = metrics?.thisWeek;
      const totalEvents = thisWeek?.totalEvents || 0;
      const completionRate = thisWeek ? (totalEvents / (totalEvents + events.length) || 0.7) : 0.7;
      const productivityScore = Math.round(completionRate * 100);

      // Calculate focus and meeting time from daily breakdown
      const focusMinutes = thisWeek?.dailyBreakdown.reduce((sum, day) => sum + day.focusTimeMinutes, 0) || 0;
      const meetingMinutes = thisWeek?.dailyBreakdown.reduce((sum, day) => sum + day.meetingTimeMinutes, 0) || 0;
      const breakMinutes = thisWeek?.dailyBreakdown.reduce((sum, day) => sum + day.breakTimeMinutes, 0) || 0;
      
      const focusHours = Math.round((focusMinutes / 60) * 10) / 10;
      const meetingHours = Math.round((meetingMinutes / 60) * 10) / 10;
      const breakHours = Math.round((breakMinutes / 60) * 10) / 10;

      // Generate insights based on analytics
      const insights = [];
      
      if (focusHours < 15) {
        insights.push({
          type: 'warning',
          message: `Low focus time detected (${focusHours}h this week). Consider blocking 2-3 hour focus sessions.`
        });
      }
      
      if (meetingHours > 20) {
        insights.push({
          type: 'warning',
          message: `High meeting load (${meetingHours}h). Try consolidating meetings to preserve focus blocks.`
        });
      }
      
      if (analysis.recommendedBlocks.length > 5) {
        insights.push({
          type: 'success',
          message: `${analysis.recommendedBlocks.length} high-quality time slots available for deep work!`
        });
      }

      setOptimizationResult({
        productivityScore,
        freeBlocks: analysis.freeBlocks.length,
        recommendedBlocks: analysis.recommendedBlocks,
        insights,
        metrics: {
          focusTime: focusHours,
          meetingTime: meetingHours,
          breakTime: breakHours,
          eventsCompleted: totalEvents,
        }
      });
    } catch (error) {
      console.error('Optimization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      text: message.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = message.trim().toLowerCase();
    setMessage("");
    setIsLoading(true);

    // Simple AI responses based on keywords
    let aiResponseText = "";
    
    const thisWeek = metrics?.thisWeek;
    const focusMinutes = thisWeek?.dailyBreakdown.reduce((sum, day) => sum + day.focusTimeMinutes, 0) || 0;
    const meetingMinutes = thisWeek?.dailyBreakdown.reduce((sum, day) => sum + day.meetingTimeMinutes, 0) || 0;
    const focusHours = Math.round((focusMinutes / 60) * 10) / 10;
    const meetingHours = Math.round((meetingMinutes / 60) * 10) / 10;
    const totalEvents = thisWeek?.totalEvents || 0;
    const totalHours = thisWeek ? Math.round((thisWeek.totalEventTime / 60) * 10) / 10 : 0;
    const mostProductiveHour = thisWeek?.mostProductiveHour || 9;
    
    if (userInput.includes('optimize') || userInput.includes('schedule')) {
      aiResponseText = "I can help optimize your schedule! Click the 'Optimize My Schedule' button above to analyze your calendar and get personalized recommendations.";
    } else if (userInput.includes('focus') || userInput.includes('deep work')) {
      aiResponseText = `You've had ${focusHours} hours of focus time this week. I recommend protecting 2-3 hour blocks in the morning for your best deep work.`;
    } else if (userInput.includes('meeting')) {
      aiResponseText = `You have ${meetingHours} hours of meetings this week. Consider batching meetings on specific days to preserve focus blocks.`;
    } else if (userInput.includes('productivity') || userInput.includes('stats')) {
      aiResponseText = `This week: ${totalEvents} events completed, ${totalHours}h productive time. Your most productive time is ${mostProductiveHour}:00.`;
    } else {
      aiResponseText = "I'm here to help optimize your schedule! Try asking about focus time, meetings, or click 'Optimize My Schedule' for a comprehensive analysis.";
    }

    setTimeout(() => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        text: aiResponseText,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating AI Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
        >
          <Bot className="w-6 h-6" />
          <Sparkles className="w-4 h-4" />
        </button>
      </div>

      {/* AI Chat Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Mally AI Assistant</h2>
                  <p className="text-sm text-blue-100">Smart Schedule Optimization</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowOptimizer(false);
                }}
                className="hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="p-4 border-b bg-gray-50">
              <Button
                onClick={handleOptimizeSchedule}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Zap className="w-4 h-4 mr-2" />
                Optimize My Schedule
              </Button>
            </div>

            {/* Optimizer Results */}
            {showOptimizer && optimizationResult && (
              <div className="p-4 border-b bg-gradient-to-br from-purple-50 to-blue-50 space-y-3 overflow-y-auto max-h-[300px]">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">Schedule Analysis</h3>
                  <Badge variant="outline" className="bg-white">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {optimizationResult.productivityScore}% Score
                  </Badge>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <Card>
                    <CardHeader className="p-3">
                      <CardTitle className="text-sm">Focus Time</CardTitle>
                      <CardDescription className="text-2xl font-bold text-blue-600">
                        {optimizationResult.metrics.focusTime}h
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="p-3">
                      <CardTitle className="text-sm">Meetings</CardTitle>
                      <CardDescription className="text-2xl font-bold text-purple-600">
                        {optimizationResult.metrics.meetingTime}h
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="p-3">
                      <CardTitle className="text-sm">Free Blocks</CardTitle>
                      <CardDescription className="text-2xl font-bold text-green-600">
                        {optimizationResult.freeBlocks}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="p-3">
                      <CardTitle className="text-sm">Events Done</CardTitle>
                      <CardDescription className="text-2xl font-bold text-orange-600">
                        {optimizationResult.metrics.eventsCompleted}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                {/* Insights */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">AI Recommendations</h4>
                  {optimizationResult.insights.map((insight: any, index: number) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border flex items-start gap-2 ${
                        insight.type === 'warning'
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      {insight.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                      )}
                      <p className="text-sm">{insight.message}</p>
                    </div>
                  ))}
                </div>

                {/* Best Time Slots */}
                {optimizationResult.recommendedBlocks.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Best Available Time Slots</h4>
                    <div className="space-y-1 max-h-[100px] overflow-y-auto">
                      {optimizationResult.recommendedBlocks.slice(0, 3).map((block: any, index: number) => (
                        <div
                          key={index}
                          className="p-2 bg-white rounded border text-sm flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium">
                              {dayjs(block.start).format('ddd, MMM D')}
                            </p>
                            <p className="text-xs text-gray-600">
                              {dayjs(block.start).format('h:mm A')} - {dayjs(block.end).format('h:mm A')} ({block.duration}min)
                            </p>
                          </div>
                          <Badge variant={block.quality === 'high' ? 'default' : 'secondary'}>
                            {block.quality} quality
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && !showOptimizer && (
                <div className="text-center py-8">
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-purple-800 mb-2 justify-center">
                      <Sparkles className="w-5 h-5" />
                      <span className="font-semibold">Phase 1 Intelligence Complete</span>
                    </div>
                    <p className="text-purple-700">
                      I can now analyze your calendar, detect conflicts, track analytics, and optimize your schedule using smart algorithms!
                    </p>
                  </div>
                  <p className="text-gray-500">
                    Try: "Optimize my schedule" or "How's my focus time?"
                  </p>
                </div>
              )}
              
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${
                      msg.isUser
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && !showOptimizer && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 max-w-[80%] p-3 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      <p className="text-sm">Thinking...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isLoading}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full p-2 transition-all duration-300"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
