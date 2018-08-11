(ns bot.main
  (:require [cognitect.transit :as t]
            [clojure.string :as str]
            [discord.js :refer [Client]]))

(def r (t/reader :json))
(def w (t/writer :json))

(def fs (js/require "fs"))
(def process (js/require "process"))

(def state (atom (t/read r (.readFileSync fs "state.json"))))
(defn write!
  [n]
  (.writeFile fs "state.json" (t/write w n)
              #(if % (.exit process 1))))
(add-watch state :transit (fn [_ _ _ n]
                              (write! n)))

(def client (Client.))

(defn find-separator [lines]
  (when-let [first-line (first lines)]
    (first
     (for [separator #{" - " ": " ". "}
           :let [ret (str/split first-line separator)]
           :when (= 2 (count ret))]
       separator))))

(defn process-lines [lines separator]
  (when (and lines separator)
    (reduce (fn [m line]
              (let [pair (str/split line separator)]
                (if (= 2 (count pair))
                  (conj m pair)
                  m)))
            {}
            lines)))

(defn process-character [text]
  (let [lines (.split text "\n")
        attrs (process-lines lines (find-separator lines))
        name (.get attrs "name")]
    (println attrs)
    (cond
      (not name) [:bad-format]
      :else (.reduce attrs #(assoc %1 %3 %2) {}))))

(defn handle-character [msg]
  (let [ret (dissoc (process-character msg.content) nil)]
    (if (map? ret)
      (swap! state assoc-in [:characters msg.author.id (get ret "name")]
             {:attrs ret :money 10000})
      (do (.delete msg) (.then (.reply msg "Bad Format") #(.delete % 10000))))))

(defn characters [state]
  (->> (:characters state) (vals) (apply merge)))

(defmulti handle-command (fn [cmd _ _] cmd))

(defmethod handle-command :default
  [cmd _ msg]
  (.then (.reply msg (str "no such command: " cmd))
         #(.delete % 10000)))

(defn find-character-in [arg in]
  (first
   (filter (fn [[k]] (.startsWith (.toLocaleLowerCase k) (.toLocaleLowerCase arg))) in)))

(defmethod handle-command "set"
  [_ arg msg]
  (let [characters-for-user (get-in @state [:characters msg.author.id])
        result (find-character-in arg characters-for-user)]
    (if result
      (swap! state assoc-in [:users msg.author.id] (key result))
      (.then (.reply msg (str "No such character: " arg))
             #(.delete % 10000)))))

(defn pr-character [m]
  (apply str (interpose \newline (reduce-kv (fn [acc k v]
                                              (conj acc (str (.toLocaleUpperCase k) " - " v)))
                                           []
                                           m))))

(defmethod handle-command "desc"
  [_ arg msg]
  (if arg
    (.send msg.author (->> (characters @state)
                           (find-character-in arg)
                           (val)
                           (:attrs)
                           (pr-character)))
    (.then (.reply msg "USAGE: ,desc <name>")
           #(.delete % 10000))))

(defmethod handle-command "pay"
  [_ arg msg]
  (if-let [name  (get (:users @state) msg.author.id)]
    (let [[_ amt :as v] (str/split arg #" ")]
      (if (= 2 (count v))
        (do
          (if (re-find #"\." amt)
            (.then (.reply msg "WARNING: ignoring decimal")
                   #(.delete % 10000)))
          (let [money (get-in @state [:characters msg.author.id name :money])
                amt (js/parseInt amt)
                to (-> msg.mentions.users .first .-id)
                to-character-name (get-in @state [:users to])]
            (if (>= money amt)
              (if to-character-name
                (swap! state update :characters
                       (fn [c]
                         (-> c
                             (update-in [to to-character-name :money] + amt)
                             (update-in [msg.author.id name :money] - amt))))
                (.then (.reply msg "Mentioned user has no character set")
                       #(.delete % 10000)))
              (.then (.reply msg "Not enough funds")
                     #(.delete % 10000)))))
        (.then (.reply msg "USAGE: ,pay @who amount")
               #(.delete % 10000))))
    (.then (.reply msg "No Character Set")
           #(.delete % 10000))))

(defn dispatch-command [msg]
  (let [[cmd arg] (str/split (subs msg.content 1) #" " 2)]
    (.delete msg 10000)
    (handle-command cmd arg msg)))

(.on client "message" (fn [msg]
                        (when-not (identical? (.-author msg) (.-user client))
                          (cond
                            (= "characters" (.-name msg.channel))
                            (handle-character msg)
                            (.startsWith msg.content ",")
                            (dispatch-command msg)))))

(.on client "ready" #(println "Logged in as" client.user.tag "-" client.user.id))

(.login client (.-token (js/require "./auth.json")))
